const database = db.getSiblingDB('industryconnect');
const counts = {};
for (const name of database.getCollectionNames().filter(name => !name.startsWith('system.')).sort()) {
  counts[name] = database.getCollection(name).countDocuments({});
}
const ledgerTotals = database.getCollection('ledgers').aggregate([
  {$group: {_id: '$kind', grossPaise: {$sum: '$grossPaise'}, expertPaise: {$sum: '$expertPaise'}, commissionPaise: {$sum: '$commissionPaise'}}},
  {$sort: {_id: 1}},
]).toArray();
print(JSON.stringify({counts, ledgerTotals}));
