'use strict';

const anonymousPosting = module.exports;

// Hook to add anonymous posting support to composer
anonymousPosting.addAnonymousOption = async function (hookData) {
	const { req, templateData } = hookData;
	
	// Only show anonymous option to logged-in users (guests are already anonymous)
	if (req.uid && parseInt(req.uid, 10) > 0) {
		// Add anonymous posting option to template data
		templateData.allowAnonymousPosting = true;
		templateData.showAnonymousOption = true;
	}
	
	return hookData;
};

// Hook to process anonymous posting data during post creation
anonymousPosting.processAnonymousPosting = async function (postData) {
	if (postData.isAnonymous && parseInt(postData.uid, 10) > 0) {
		// This is handled in src/posts/create.js already
		// Just ensure the flag is properly set
		postData.isAnonymous = 1;
	}
	
	return postData;
};