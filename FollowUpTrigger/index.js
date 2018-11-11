const azure = require('azure-storage');
const https = require('https');

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
    const estimation = await getEstimation(context);
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
