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
    context.log('Got ' + timesheetLines.length + ' timesheet lines');
    let result = {};
    result.Name = estimation.Name;
    result.TimePeriodTitle = estimation.TimePeriodTitle;

    result.FollowUpLines = [];

    if (estimation.EstimationLines) {
	for (let estimationLine of estimation.EstimationLines) {
	    let followUpLine = {};
	    followUpLine.State = estimationLine.State;
	    followUpLine.NavJobNumber = estimationLine.NavJobNumber;
            followUpLine.NavTaskNumber = estimationLine.NavTaskNumber;
            followUpLine.TfsNumber = estimationLine.TfsNumber;
            followUpLine.BaseLine = estimationLine.Baseline;

	    let correspondingJobTaskLine = null;
	    if (timesheetLines) {
		correspondingJobTaskLine = timesheetLines.filter(tl => {
		    const jobNumber = tl.JobNumber.replace('JOB','')
			  .replace(/^0+/,'');
		    if (jobNumber === estimationLine.NavJobNumber) {
			return tl.TaskNumber === estimationLine.NavTaskNumber;
		    }
		    return false;
		})[0];
		if (correspondingJobTaskLine) {
		    followUpLine.Project = correspondingJobTaskLine.JobName;
                    followUpLine.Task = correspondingJobTaskLine.TaskDescription;
		} else {
		    // try to find it in the jobs
		    const jobTaskLines = await getTaskLines(context, tableService, null, [], followUpLine.NavJobNumber);
		    const task = jobTaskLines.filter(tl => {
			return tl.RowKey === estimationLine.NavTaskNumber;
		    })[0];
		    if (task) {
			followUpLine.Task = task.Description;
		    }
		}
	    }

	    result.FollowUpLines.push(followUpLine);
	}
    }

    // Prepare week buckets
    let startingDate = new Date(new Date().getFullYear(), 0, 1);
    if (estimation.StartDate) {
	startingDate = new Date(estimation.StartDate);
    }
    let bucketStartDay = 1; // Monday
    if (process.env.BUCKET_START_DAY) {
	bucketStartDay = Number(process.env.BUCKET_START_DAY);
    }
    context.log('Starting day is ' + bucketStartDay);
    while (startingDate.getDay() !== bucketStartDay) {
	let d = new Date(startingDate.valueOf());
	d.setDate(d.getDate() - 1);
	startingDate = d;
    }
    context.log('Starting date is ' + startingDate);

    return result;
}

module.exports = async function (context, req) {
    context.log('Calculating summary');
    const summary = await calculateSummary(context);
    return {
        body: summary,
        status: 200
    };
};
