const mongoose = require('mongoose');
const { Transaction, initDatabase } = require('./src/db/database');

(async () => {
    await initDatabase();
    
    const txns = await Transaction.find({}).limit(5).lean();
    console.log('Sample transactions:');
    txns.forEach(t => {
        console.log('  user_id type=' + typeof t.user_id + ' value=' + t.user_id + ' category=' + t.category + ' txnType=' + t.type + ' date=' + t.date);
    });
    
    const userId = txns[0] ? txns[0].user_id : null;
    if (userId) {
        console.log('\n--- Aggregation with ObjectId ---');
        const cats = await Transaction.aggregate([
            { $match: { user_id: new mongoose.Types.ObjectId(userId), type: 'expense' } },
            { $group: { _id: '$category', total: { $sum: '$amount' } } },
            { $sort: { total: -1 } }
        ]);
        console.log(JSON.stringify(cats, null, 2));
        
        console.log('\n--- Aggregation with string ---');
        const cats2 = await Transaction.aggregate([
            { $match: { user_id: userId.toString(), type: 'expense' } },
            { $group: { _id: '$category', total: { $sum: '$amount' } } },
            { $sort: { total: -1 } }
        ]);
        console.log(JSON.stringify(cats2, null, 2));
    } else {
        console.log('No transactions found');
    }
    
    process.exit(0);
})();
