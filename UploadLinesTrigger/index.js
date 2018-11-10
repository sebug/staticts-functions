
module.exports = function (context, req) {
    context.log('Uploading file');
    if (!req.body || !req.body.length) {
	context.log('Did not receive a body');
    } else {
	context.log('Got ' + req.body.length + ' lines');
	context.log(JSON.stringify(req.body[0]));
    }
    context.res = {
	body: 'Uploaded',
	status: 200
    };
    context.done();
};
