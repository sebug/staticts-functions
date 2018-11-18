const https = require('https');
const ko = require('knockout');

function fetchFollowUpPage() {
    return new Promise((resolve, reject) => {
        https.get(process.env.FOLLOW_UP_URL, (resp) => {
            let data = '';

            resp.on('data', (chunk) => {
                data += chunk;
            });
            
            resp.on('end', () => {
                resolve(data);
            });
        });
    });
}

module.exports = async function (context, req) {
    const followUpPageContent = await fetchFollowUpPage();
    context.log('Beginning is ' + followUpPageContent.substring(0, 100));
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
