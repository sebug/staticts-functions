
module.exports = function (context, req) {
    context.log('Uploading file');
    context.res = {
	body: 'Uploaded',
	status: 200
    };
    context.done();
};
