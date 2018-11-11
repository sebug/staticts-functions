const azure = require('azure-storage');
const https = require('https');

function objectifyEntity(tle) {
    let result = {};
    if (tle) {
	Object.keys(tle).forEach(k => {
	    result[k] = tle[k]._;
	});
    }
    return result;
}

function getTimesheetLines(context, tableService, continuationToken, loadedResults) {
    return getTableEntities(context, tableService, continuationToken, loadedResults, 'timesheetLines', 'prod');
}

function getTaskLines(context, tableService, continuationToken, loadedResults, jobNumber) {
    return getTableEntities(context, tableService, continuationToken, loadedResults, 'timesheetLines', jobNumber);
}

function getTableEntities(context, tableService, continuationToken, loadedResults, tableName, partitionName) {
    if (!loadedResults) {
	loadedResults = [];
    }
    return new Promise((resolve, reject) => {
	const query = new azure.TableQuery()
	      .where('PartitionKey eq ?', partitionName);
	tableService.queryEntities(tableName, query, continuationToken, (error, result, response) => {
	    if (error) {
		reject(error);
	    } else {
		const lines = loadedResults.concat(result.entries.map(objectifyEntity));
		if (result.continuationToken) {
		    getTableEntities(context, tableService, result.continuationToken, lines, tableName, partitionName).then(allLines => {
			resolve(allLines);
		    });
		} else {
		    resolve(lines);
		}
	    }
	});
    });
}

function getEstimation(context) {
    return new Promise((resolve, reject) => {
	https.get(process.env.GIST_URL, (resp) => {
	    let data = '';

	    resp.on('data', (chunk) => {
		data += chunk;
	    });
	    
	    resp.on('end', () => {
		const estimationResult = JSON.parse(data);

		context.log('got ' + estimationResult.EstimationLines.length + ' estimation lines');

		resolve(estimationResult);
	    });
	});
    });
}

async function calculateSummary(context) {
    const tableService = azure.createTableService();
    
    const estimation = await getEstimation(context);
    const timesheetLines = await getTimesheetLines(context, tableService, null, []);
    const tasks = await getTaskLines(context, tableService, null, [], '592');
    context.log('Got ' + timesheetLines.length + ' timesheet lines');
    context.log('the first task is ');
    context.log(JSON.stringify(tasks[0]));
    return estimation;
}

module.exports = async function (context, req) {
    context.log('Calculating summary');
    const summary = await calculateSummary(context);
    return {
        body: summary,
        status: 200
    };
};
