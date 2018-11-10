const azure = require('azure-storage');

function storeEntity(tableService, entity) {
    return new Promise((resolve, reject) => {
	tableService.insertOrReplaceEntity('timesheetLines', entity, (error, result, response) => {
	    if (!error) {
		resolve(result);
	    } else {
		reject(error);
	    }
	});
    });
}

async function storeLines(lines, context) {
    const tableService = azure.createTableService();
    const entGen = azure.TableUtilities.entityGenerator;

    const partition = 'prod';

    const entities = lines.map(line => {
	return {
	    PartitionKey: entGen.String(partition),
	    RowKey: entGen.String(line.lineNumber),
	    StartDate: entGen.String(line.startDate),
	    EndDate: entGen.String(line.endDate),
	    JobNumber: entGen.String(line.jobNumber),
	    JobName: entGen.String(line.jobName),
	    ClientNumber: entGen.String(line.clientNumber),
	    ClientName: entGen.String(line.clientName),
	    TaskNumber: entGen.String(line.taskNumber),
	    TaskDescription: entGen.String(line.taskDescription),
	    SiteCode: entGen.String(line.siteCode),
	    WorkTypeCode: entGen.String(line.workTypeCode),
	    WorkTypeDescription: entGen.String(line.workTypeDescription),
	    QuantityWorked: entGen.Double(line.quantityWorked),
	    InvoiceQuantity: entGen.Double(line.invoiceQuantity)
	};
    });

    for (let entity of entities) {
	const importResult = await storeEntity(tableService, entity);
	context.log('Saved ' + entity.RowKey._);
    }
    
    return true;
}

module.exports = async function (context, req) {
    context.log('Uploading file...');
    if (!req.body || !req.body.length) {
	context.log('Did not receive a body');
	return {
	    body: 'Nothing received',
	    status: 200
	};
    } else {
	const storeResult = await storeLines(req.body, context);
	context.log('Store result is ' + storeResult);
	return {
	    body: 'Upload complete',
	    status: 200
	};
    }
};
