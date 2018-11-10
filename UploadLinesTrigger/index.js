const azure = require('azure-storage');

function storeLines(lines, context) {
    return new Promise((resolve, reject) => {
	context.log('Got ' + lines.length + ' lines!');
	context.log(JSON.stringify(lines[0]));
	resolve(true);
    });
}

module.exports = function (context, req) {
    context.log('Uploading file...');
    if (!req.body || !req.body.length) {
	context.log('Did not receive a body');
	context.res = {
	    body: 'Nothing received',
	    status: 200
	};
	context.done();
    } else {
	storeLines(req.body, context).then(storeResult => {
	    context.log('Store result is ' + storeResult);
	    context.res = {
		body: 'Upload complete',
		status: 200
	    };
	    context.done();
	});
    }
};
