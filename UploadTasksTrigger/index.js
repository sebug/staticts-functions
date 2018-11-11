const azure = require('azure-storage');

function storeEntity(tableService, entity) {
    return new Promise((resolve, reject) => {
        tableService.insertOrReplaceEntity('tasks', entity, (error, result, response) => {
            if (!error) {
                resolve(result);
            } else {
                reject(error);
            }
        });
    });
}

async function storeLines(jobNumber, lines, context) {
    const tableService = azure.createTableService();
    const entGen = azure.TableUtilities.entityGenerator;

    const entities = lines.map(line => {
        return {
            PartitionKey: entGen.String(jobNumber),
            RowKey: entGen.String(line.taskNumber),
	    TaskDescription: entGen.String(line.taskDescription)
        };
    });

    for (let entity of entities) {
        const importResult = await storeEntity(tableService, entity);
        context.log('Saved ' + entity.PartitionKey._ + ' - ' + entity.RowKey._);
    }
    
    return entities.length;
}

module.exports = async function (context, req) {
    context.log('Uploading tasks...');
    if (!req.body || !req.body.length || !req.query || !req.query.jobNumber) {
        context.log('Did not receive a body');
        return {
            body: 'Nothing received',
            status: 200
        };
    } else {
        const storeResult = await storeLines(req.query.jobNumber, req.body, context);
        context.log('Store result is ' + storeResult);
        return {
            body: 'Upload tasks complete',
            status: 200
        };
    }
};
