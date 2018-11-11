const azure = require('azure-storage');

function calculateSummary() {
    return new Promise((resolve, reject) => {
	resolve({
	    name: 'Sebastian Gfeller'
	});
    });
}

module.exports = async function (context, req) {
    context.log('Calculating summary');
    const summary = await calculateSummary();
    context.log('Summary result is ' + JSON.stringify(summary));
    context.log('Gist url is ' + process.env.GIST_URL);
    return {
        body: summary,
        status: 200
    };
};
