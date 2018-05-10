var config = require("../config/common.js").info;
var web3 = require('../config/common').web3;

var TransactionModel = require("../model/transactions");
var TokenModel = require("../model/tokens");
var ServiceInofModel = require("../model/serviceinfo");


var lastCheckedBlock = 0;
var lastCheckedIndex = 0;
var cronServiceInfo = null;

async function getLastCheckedBlock() {
	try {
		cronServiceInfo = await ServiceInofModel.findOne();
		if (cronServiceInfo) {
			lastCheckedBlock = cronServiceInfo.lastblock;
			lastCheckedIndex = cronServiceInfo.lastTxnIndex;
			console.log("Last checked block number is " + lastCheckedBlock);
			console.log("Last checked txn index is " + lastCheckedIndex);
		}
	}
	catch(e) {
		console.log("getLastCheckedBlock error: ", e);
	}
}

async function saveCronServiceInfo() {
	await ServiceInofModel.findOne(async function(e, info) {
		if (!e) {
			if (info) {
	        	info.set({lastblock: lastCheckedBlock, lastTxnIndex: lastCheckedIndex});
	        }
	        else {
	        	info = new ServiceInofModel({lastblock: lastCheckedBlock, lastTxnIndex: lastCheckedIndex});
	        }
	        await info.save();
	    }
	    else {
	    	console.log('saveCronServiceInfo:error: ', e); // Should dump errors here
	    }
	});
	    
}

async function CheckUpdatedTransactions() {
    await web3.eth.getBlockNumber(async  function(error, number) {
        var iCount = 0;
        if (!error) {
        	var limit = lastCheckedBlock + config.CRON_TREAT_MAX_BLOCKS;
            for (let i = lastCheckedBlock; i <= number && i <= limit; i ++) {
            	try {
                	var blockdata = await web3.eth.getBlock(i, true); 
   	            }
	            catch(e) {
                    console.log("iCount --------------" + iCount ++);
	                console.log('getBlock: error: ', e); // Should dump errors here
                    return;
	            }
                
                var txnCount = blockdata.transactions.length;
                
                for (let j = lastCheckedIndex + 1; j < txnCount; j ++) {
                	let transaction = blockdata.transactions[j];
                    let hash = transaction.hash;
                    let from = transaction.from;
                    let to = transaction.to;
                    let value = transaction.value;
                    var timestamp = blockdata.timestamp;

                    let gasprice = transaction.gasPrice;

                    try {
                    	var txnReceipt = await web3.eth.getTransactionReceipt(hash);
                    }
		            catch(e) {
                        console.log("iCount --------------" + iCount ++);
		                console.log('getTransactionReceipt: error: ', e); // Should dump errors here
                        return;
		            }


                    let fee = gasprice * txnReceipt.gasUsed;

                    var newTxn = new TransactionModel({
                    	blocknumber: i,
                    	hash: hash,
                    	from: from,
                    	to: to,
                    	value: value,
                    	fee: fee,
                    	timestamp: timestamp
                    });

                    try {
                    	await newTxn.save();
   	   	            }
		            catch(e) {
                        console.log("iCount --------------" + iCount ++);
		                console.log('newTxn.save: error: ', e); // Should dump errors here
                        return;
	            	}


                    if (lastCheckedBlock != i || lastCheckedIndex != j) {
                    	// console.log("Updating block: " + i);
						lastCheckedBlock = i;
                        lastCheckedIndex = j;

						await saveCronServiceInfo();
                    }
                }

                if (lastCheckedBlock != i || lastCheckedIndex != -1) {
                	// console.log("Updating block: " + i);
					lastCheckedBlock = i;
                    lastCheckedIndex = -1;

					await saveCronServiceInfo();
                }

            }
        }
        else {
            console.log('getBlockNumber: we have a promblem: ', error); // Should dump errors here
        }
    });
}


// async function transactionService() {
// 	console.log("lastCheckedBlock = " + lastCheckedBlock);
// 	await CheckUpdatedTransactions();
// 	setTimeout(transactionService, config.CRON_TIME_INTERVAL);
// }

async function transactionService() {
    console.log("lastCheckedBlock = " + lastCheckedBlock);
    CheckUpdatedTransactions();
}

exports.start_cronService = async function() {
	console.log("Start ethereum cron service");
	await getLastCheckedBlock();

	//transactionService();
    setInterval(transactionService, config.CRON_TIME_INTERVAL);
}