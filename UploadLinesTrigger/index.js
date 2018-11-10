const azure = require('azure-storage');

function storeLines(lines, context) {
    return new Promise((resolve, reject) => {
	context.log('Got ' + lines.length + ' lines!');
	context.log(JSON.stringify(lines[0]));
	resolve(true);
    });
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
