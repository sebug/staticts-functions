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
    return getTableEntities(context, tableService, continuationToken, loadedResults, 'tasks', jobNumber);
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

function groupTimesheetLinesByJobAndTask(timesheetLines) {
    timesheetLines = timesheetLines || [];
    let groups = {};
    let result = [];
    for (let tl of timesheetLines) {
	const jobNumber = tl.JobNumber.replace('JOB','')
	      .replace(/^0+/,'');
	const taskNumber = tl.TaskNumber;
	const key = jobNumber + '_' + taskNumber;
	if (!groups[key]) {
	    groups[key] = [];
	    result.push({
		JobNumber: jobNumber,
		TaskNumber: taskNumber,
		Lines: groups[key]
	    });
	}
	groups[key].push(tl);
    }
    return result;
}

function* getDateBuckets(startDate) {
    let sd = new Date(startDate.valueOf());
    while (sd <= new Date().valueOf()) {
	let toDate = new Date(sd.valueOf());
	toDate.setDate(toDate.getDate() + 6);
	const dateBucket = {
	    From: sd,
	    To: toDate
	};
	yield dateBucket;

	sd = new Date(sd.valueOf());
	sd.setDate(sd.getDate() + 7);
    }
}

function formatBucketString(db) {
    if (!db) {
	return '';
    }
    let startDate = '' + db.From.getDate();
    if (startDate.length === 1) {
	startDate = '0' + startDate;
    }
    let startMonth = '' + (db.From.getMonth() + 1);
    if (startMonth.length === 1) {
	startMonth = '0' + startMonth;
    }
    let endDate = '' + db.To.getDate();
    if (endDate.length === 1) {
	endDate = '0' + endDate;
    }
    let endMonth = '' + (db.To.getMonth() + 1);
    if (endMonth.length === 1) {
	endMonth = '0' + endMonth;
    }
    return startDate + '.' + startMonth +
	' - ' +
	endDate + '.' + endMonth;
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
		    const jobTaskLines = await getTaskLines(context, tableService, null, [], '' + followUpLine.NavJobNumber);
		    const task = jobTaskLines.filter(tl => {
			return tl.RowKey === '' + estimationLine.NavTaskNumber;
		    })[0];
		    if (task) {
			followUpLine.Task = task.TaskDescription;
		    } else {
			context.log('not found task with number "' + estimationLine.NavTaskNumber + '" for job ' + followUpLine.NavJobNumber);
		    }

		    // also, try to find out the project name if at all possible
		    const otherTimesheetLineOfSameJob = timesheetLines.filter(tl => {
			const jobNumber = tl.JobNumber.replace('JOB','')
			      .replace(/^0+/,'');
			if (jobNumber === estimationLine.NavJobNumber) {
			    return tl.JobName;
			}
			return false;
		    })[0];
		    if (otherTimesheetLineOfSameJob) {
			followUpLine.Project = otherTimesheetLineOfSameJob.JobName;
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
    while (startingDate.getDay() !== bucketStartDay) {
	let d = new Date(startingDate.valueOf());
	d.setDate(d.getDate() - 1);
	startingDate = d;
    }
    context.log('Starting date is ' + startingDate);

    const rangeTimesheetLines = timesheetLines.filter(tl => {
	const startDateMatches = new Date(tl.StartDate).valueOf() >= startingDate.valueOf();
	return startDateMatches; // TODO: allow for yearly summaries by also defining end date
    });

    let timesheetLinesGroupedByJobAndTask = groupTimesheetLinesByJobAndTask(rangeTimesheetLines);

    for (let tg of timesheetLinesGroupedByJobAndTask) {
	if (!result.FollowUpLines.filter(fu => {
	    return fu.NavJobNumber === tg.JobNumber && fu.NavTaskNumber === tg.TaskNumber;
	})[0]) {
	    const followUpLine= {
		State: 'Open',
		NavJobNumber: tg.JobNumber,
		NavTaskNumber: tg.TaskNumber,
		Project: tg.Lines[0].JobDescription,
		Task: tg.Lines[0].TaskDescription,
		TfsNumber: '',
		BaseLine: null
	    };
	    context.log('Added ' + JSON.stringify(followUpLine));
	    result.FollowUpLines.push(followUpLine);
	}
    }

    const dateBuckets = Array.from(getDateBuckets(startingDate));

    const dateBucketStrings = dateBuckets.map(formatBucketString);

    result.DateBuckets = dateBucketStrings;

    const hoursPerDay = 8; // No environment variable for this :-)

    let isFirst = true;
    for (let tl of rangeTimesheetLines) {
	const jobNumber = tl.JobNumber.replace('JOB','')
	      .replace(/^0+/,'');
	const correspondingFollowUpLine = result.FollowUpLines.filter(fu => fu.NavTaskNumber === tl.TaskNumber && fu.NavJobNumber === jobNumber)[0];
	if (correspondingFollowUpLine) {
	    const correspondingBucket = dateBuckets.filter(db => new Date(tl.StartDate) >= db.From && new Date(tl.StartDate) <= db.To)[0];
	    const correspondingBucketString = formatBucketString(correspondingBucket);
	    if (isFirst) {
		isFirst = false;
		context.log('Corresponding bucket string is ' + correspondingBucketString);
	    }

	    if (!correspondingFollowUpLine.TimeSpent) {
		correspondingFollowUpLine.TimeSpent = {};
	    }

	    if (!correspondingFollowUpLine.TimeSpent[correspondingBucketString]) {
		correspondingFollowUpLine.TimeSpent[correspondingBucketString] = 0;
	    }

	    if (tl.QuantityWorked) {
		correspondingFollowUpLine.TimeSpent[correspondingBucketString] += tl.QuantityWorked / hoursPerDay;
	    }
	} else {
	    context.log('No follow-up line found for ' + JSON.stringify(tl));
	}

	for (let fu of result.FollowUpLines) {
	    if (fu.TimeSpent) {
		let sum = 0;
		for (let k in fu.TimeSpent) {
		    if (typeof fu.TimeSpent[k] === 'number') {
			sum += fu.TimeSpent[k] || 0;
		    }
		}
		fu.TotalTimeSpent = sum;
	    }
	}
    }

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
