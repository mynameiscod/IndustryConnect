export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}
export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-Market-Request': '1', ...options.headers },
  });
  if (response.status === 204) return undefined as T;
  const result = await response
    .json()
    .catch(() => ({
      error: { message: 'The server is unavailable. Please try again.', code: 'UNAVAILABLE' },
    }));
  if (!response.ok)
    throw new ApiError(
      result.error?.message ?? 'The request failed',
      response.status,
      result.error?.code ?? 'ERROR',
    );
  return result as T;
}
export const post = <T = any>(path: string, data: unknown = {}, method = 'POST') =>
  api<T>(path, { method, body: JSON.stringify(data) });
const scripts = new Map<string, Promise<void>>();
export function loadScript(src: string) {
  if (!scripts.has(src))
    scripts.set(
      src,
      new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => {
          scripts.delete(src);
          reject(new Error('Unable to load the provider. Try again.'));
        };
        document.head.append(script);
      }),
    );
  return scripts.get(src)!;
}
declare global {
  interface Window {
    Razorpay?: new (options: any) => {
      open: () => void;
      on: (event: string, callback: (response: any) => void) => void;
    };
    google?: any;
  }
}
export async function checkout(
  bookingId: string,
  onComplete: () => void,
  onError: (message: string) => void,
) {
  const order = await post(`/bookings/${bookingId}/order`);
  await loadScript('https://checkout.razorpay.com/v1/checkout.js');
  if (!window.Razorpay) throw new Error('Checkout could not load');
  const instance = new window.Razorpay({
    key: order.keyId,
    amount: order.amount,
    currency: order.currency,
    order_id: order.orderId,
    name: 'Expert Market',
    description: 'Expert appointment',
    theme: { color: '#14352f' },
    handler: async (response: any) => {
      try {
        await post(`/bookings/${bookingId}/payment/verify`, response);
        onComplete();
      } catch (error) {
        onError(
          `${error instanceof Error ? error.message : 'Verification pending'}. Check your dashboard before paying again.`,
        );
        onComplete();
      }
    },
    modal: { ondismiss: onComplete },
  });
  instance.on('payment.failed', () =>
    onError('Payment was not completed. Your booking status will show the latest result.'),
  );
  instance.open();
}
