'use strict';

const helpers = module.exports;

function isBetterCandidate(candidate, selectedArray, sort) {
	if (!candidate.length) {
		return false;
	}
	if (!selectedArray.length) {
		return true;
	}
	if (sort === 1) {
		return candidate[0].score < selectedArray[0].score;
	}
	if (sort === -1) {
		return candidate[0].score > selectedArray[0].score;
	}
	return false;
}

function getFirst(batchData, sort) {
	let selectedArray = batchData[0];

	for (let i = 1; i < batchData.length; i++) {
		if (isBetterCandidate(batchData[i], selectedArray, sort)) {
			selectedArray = batchData[i];
		}
	}

	return selectedArray.length ? selectedArray.shift() : null;
}

function shouldContinue(item, resultLength, start, stop) {
	if (!item) {
		return false;
	}
	if (stop === -1) {
		return true;
	}
	return resultLength < (stop - start + 1);
}

helpers.mergeBatch = function (batchData, start, stop, sort) {
	let item = null;
	const result = [];

	do {
		item = getFirst(batchData, sort);
		if (item) {
			result.push(item);
		}
	} while (shouldContinue(item, result.length, start, stop));

	return result;
};