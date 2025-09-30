const Categories = require('../src/categories');

async function run() {
	// Simulate data for category 1
	const data = {
		cid: 1,
		start: 0,
		stop: 49,
		uid: 1,
		query: 'test',
	};

	try {
		// Call the public function that ultimately fires filter:categories.getTopicIds
		const tids = await Categories.getTopicIds(data);
		console.log('Result tids:', tids);
	} catch (err) {
		console.error('Error in smoke test:', err);
	}
}

run();
