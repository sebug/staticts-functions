const https = require('https');
const ko = require('knockout');

module.exports = async function (context, req) {
    context.log('rendering follow-up page ' + process.env.FOLLOW_UP_URL);
    context.log(typeof ko);
    return {
	body: '<!DOCTYPE html>' +
	    '<html>' +
	    '<head>' +
	    '<title>Pre-rendered follow-up</title>' +
	    '<meta charset="utf-8">' +
	    '</head>' +
	    '<body>' +
	    '<h1>Pre-rendered follow-up</h1>' +
	    '</body>' +
	    '</html>',
	status: 200,
	headers: {
	    'Content-Type': 'text/html'
	}
    };
};
