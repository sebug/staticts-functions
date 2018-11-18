const https = require('https');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

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

async function renderFollowUpPage(context) {
    const followUpPageContent = await fetchFollowUpPage();

    const dom = new JSDOM(followUpPageContent, {
	url: process.env.FOLLOW_UP_URL,
	runScripts: 'dangerously'
    });

    const trs = dom.window.document.querySelectorAll('tr');

    context.log('Dangerous script execution, got ' + trs.length + ' trs');

    return followUpPageContent;
}

module.exports = async function (context, req) {
    const followUpPageContent = await renderFollowUpPage(context);
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
