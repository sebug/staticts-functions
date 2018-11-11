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
    if (!loadedResults) {
	loadedResults = [];
    }
    return new Promise((resolve, reject) => {
	const query = new azure.TableQuery()
	      .where('PartitionKey eq ?', 'prod');
	tableService.queryEntities('timesheetLines', query, continuationToken, (error, result, response) => {
	    if (error) {
		reject(error);
	    } else {
		const lines = loadedResults.concat(result.entries.map(objectifyEntity));
		if (result.continuationToken) {
		    getTimesheetLines(context, tableService, result.continuationToken, lines).then(allLines => {
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
    context.log('Got ' + timesheetLines.length + ' timesheet lines');
    context.log('the first is ');
    context.log(JSON.stringify(timesheetLines[0]));
    return estimation;
}

module.exports = async function (context, req) {
    context.log('Calculating summary');
    const summary = await calculateSummary(context);
    context.log('Summary result is ' + JSON.stringify(summary));
    context.log('Gist url is ' + process.env.GIST_URL);
    return {
        body: summary,
        status: 200
    };
};
