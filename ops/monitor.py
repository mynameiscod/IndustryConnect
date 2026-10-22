#!/usr/bin/env python3
"""Root-owned local monitoring. No customer records or credentials enter alerts."""
import datetime
import json
import os
from pathlib import Path
import shutil
import socket
import ssl
import subprocess
import time
import urllib.request

ROOT = Path('/opt/industryconnect')

def command(*args):
    return subprocess.check_output(args, timeout=40, stderr=subprocess.DEVNULL).decode()

def collect():
    alerts = {}
    def check(code, message, action):
        try:
            if not action(): alerts[code] = message
        except Exception:
            alerts[code] = message
    check('api', 'API readiness failed', lambda: json.loads(urllib.request.urlopen('http://127.0.0.1:4000/api/ready', timeout=5).read())['ready'] is True)
    for service in ['api', 'worker', 'mongo']:
        def healthy(service=service):
            state = json.loads(command('docker', 'inspect', '--format', '{{json .State}}', f'industryconnect-{service}-1'))
            return state['Running'] and not state.get('Paused', False) and state.get('Health', {}).get('Status') == 'healthy'
        check(service + '_container', f'{service} container is not healthy', healthy)
    usage = shutil.disk_usage(ROOT)
    if usage.free / usage.total < .15: alerts['disk'] = 'Disk has less than 15 percent free space'
    archives = list((ROOT / 'backups').glob('industryconnect-*.archive.gpg'))
    if not archives or time.time() - max(p.stat().st_mtime for p in archives) > 36 * 3600:
        alerts['backup'] = 'No completed encrypted backup within 36 hours'
    if archives:
        latest = max(archives, key=lambda p: p.stat().st_mtime)
        configuration = latest.with_name(latest.name.replace('.archive.gpg', '.config.tar.gpg'))
        if not configuration.is_file(): alerts['backup_config'] = 'Latest database backup has no encrypted configuration companion'
    check('backup_job', 'Last scheduled backup job failed', lambda: command('systemctl', 'show', 'industryconnect-backup.service', '--property=Result', '--value').strip() == 'success')
    def tls():
        with socket.create_connection(('iconnect.codebegun.com', 443), timeout=5) as sock:
            with ssl.create_default_context().wrap_socket(sock, server_hostname='iconnect.codebegun.com') as secured:
                expiry = ssl.cert_time_to_seconds(secured.getpeercert()['notAfter'])
                return expiry - time.time() > 14 * 86400
    check('tls', 'HTTPS unavailable or certificate expires within 14 days', tls)
    try:
        jobs = json.loads(command('docker', 'exec', 'industryconnect-api-1', 'node', 'apps/api/dist/ops-status.js'))
        for key in ['failedJobs', 'expiredWorkerLeases', 'paymentExceptions', 'unknownPayouts']:
            if jobs[key]: alerts[key] = f'{key}: {jobs[key]} records require attention'
        if jobs['oldestDueSeconds'] > 900: alerts['queue_age'] = 'Due queue is delayed more than 15 minutes'
    except Exception:
        alerts['queue_probe'] = 'Could not inspect worker and payment queue state'
    return alerts

def transitions(previous, current):
    events = []
    for code, message in current.items():
        if previous.get(code) != message: events.append({'status': 'alert', 'code': code, 'message': message})
    for code in previous.keys() - current.keys():
        events.append({'status': 'resolved', 'code': code, 'message': 'Check recovered'})
    return events

def main():
    os.umask(0o077)
    directory = ROOT / 'monitoring'
    directory.mkdir(mode=0o700, exist_ok=True)
    state_path = directory / 'state.json'
    try: previous = json.loads(state_path.read_text())
    except (FileNotFoundError, ValueError): previous = {}
    current = collect()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    events = transitions(previous.get('alerts', {}), current)
    if current and time.time() - previous.get('lastReminder', 0) >= 6 * 3600 and not events:
        events = [{'status': 'reminder', 'code': code, 'message': text} for code, text in current.items()]
    webhook = os.environ.get('ALERT_WEBHOOK_URL', '')
    for event in events:
        event.update(service='IndustryConnect', observedAt=now)
        line = json.dumps(event)
        print(line, flush=True)
        with (directory / 'events.jsonl').open('a') as log: log.write(line + '\n')
        if webhook:
            try:
                request = urllib.request.Request(webhook, data=line.encode(), headers={'Content-Type': 'application/json'})
                with urllib.request.urlopen(request, timeout=10) as response:
                    if response.status >= 300: raise RuntimeError('Delivery failed')
            except Exception:
                print(json.dumps({'status': 'delivery_failed', 'service': 'IndustryConnect'}), flush=True)
    state = {'observedAt': now, 'alerts': current, 'lastReminder': time.time() if events else previous.get('lastReminder', 0)}
    temporary = state_path.with_suffix('.tmp')
    temporary.write_text(json.dumps(state, indent=2))
    temporary.replace(state_path)
    if current: raise SystemExit(1)

if __name__ == '__main__': main()
