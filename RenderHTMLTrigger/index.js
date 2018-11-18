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
    let followUpPageContent = await fetchFollowUpPage();

    // Add the fetch polyfill in the header
    const fetchAdditions = '<script src="https://cdnjs.cloudflare.com/ajax/libs/fetch/2.0.3/fetch.js"></script>';
    const firstScriptIndex = followUpPageContent.indexOf('<script');

    followUpPageContent = followUpPageContent.substring(0, firstScriptIndex) +
	fetchAdditions +
	followUpPageContent.substring(firstScriptIndex, followUpPageContent.length);

    const virtualConsole = new jsdom.VirtualConsole();

    virtualConsole.on('error', function (err, more) {
	context.log('Error ' + JSON.stringify(err));
	if (arguments.length > 1) {
	    context.log(more);
	}
    });
    virtualConsole.on('log', msg => {
	context.log(msg);
    });

    const dom = new JSDOM(followUpPageContent, {
	url: process.env.FOLLOW_UP_URL,
	runScripts: 'dangerously',
	resources: 'usable',
	pretendToBeVisual: true,
	virtualConsole: virtualConsole
    });

    const waitBetweenPolls = 10 * 1000; // 10 s
    const numberOfTries = 20;

    const trsPromise = new Promise((resolve, reject) => {
	function waitForTrs(iterationsLeft) {
	    if (iterationsLeft <= 0) {
		reject('No trs found after all');
	    } else {
		const trs = dom.window.document.querySelectorAll('tr');
		if (trs.length === 0) {
		    // wait a bit longer
		    context.log('Nothing found at ' + iterationsLeft);
		    setTimeout(() => waitForTrs(iterationsLeft - 1), waitBetweenPolls);
		} else {
		    resolve(trs.length);
		}
	    }
	}

	waitForTrs(numberOfTries);
    });

    const numberOfTrs = await trsPromise;

    context.log('Dangerous script execution, got ' + numberOfTrs + ' trs');

    // Now let's remove the script elements and return the doc
    const scriptElements = dom.window.document.querySelectorAll('script');

    context.log('got ' + scriptElements.length + ' script elements, removing them');

    for (let i = 0; i < scriptElements.length; i += 1) {
	let scriptElement = scriptElements[i];
	scriptElement.parentNode.removeChild(scriptElement);
    }

    const newPageContent = dom.serialize();

    const withoutCustomTags = newPageContent.replace('<follow-up>','')
	  .replace('</follow-up>', '');

    return withoutCustomTags;
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
