const azure = require('azure-storage');

function storeLines(lines, context) {
    context.log('Got ' + lines.length + ' lines!');
    context.log(JSON.stringify(lines[0]));
}

module.exports = function (context, req) {
    context.log('Uploading file...');
    if (!req.body || !req.body.length) {
	context.log('Did not receive a body');
    } else {
	storeLines(req.body, context);
    }
    context.res = {
	body: 'Uploaded',
	status: 200
    };
    context.done();
};
