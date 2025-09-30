'use strict';

const qs = require('querystring');
const _ = require('lodash');

const pagination = module.exports;

function normalizeCounts(cp, pc) {
	pc = parseInt(pc, 10);
	if (pc <= 1) {
		return { currentPage: 1, pageCount: 1, trivial: true };
	}
	cp = parseInt(cp, 10) || 1;
	return { currentPage: cp, pageCount: pc, trivial: false };
}

function computePagesToShow(current, pageCount) {
	const pages = [1, 2, pageCount - 1, pageCount];
	let startPage = Math.max(1, current - 2);
	if (startPage > pageCount - 5) {
		startPage -= 2 - (pageCount - current);
	}
	for (let i = 0; i < 5; i += 1) {
		pages.push(startPage + i);
	}
	return _.uniq(pages).filter(p => p > 0 && p <= pageCount).sort((a, b) => a - b);
}

function buildPageObjects(pagesToShow, current, baseQuery) {
	const q = { ...(baseQuery || {}) };
	delete q._;
	return pagesToShow.map((page) => {
		q.page = page;
		return { page: page, active: page === current, qs: qs.stringify(q) };
	});
}

function insertSeparators(pages, queryObj) {
	const result = pages.slice();
	for (let i = result.length - 1; i > 0; i -= 1) {
		const prevPage = result[i].page - 1;
		if (result[i].page - 2 === result[i - 1].page) {
			result.splice(i, 0, { page: prevPage, active: false, qs: qs.stringify({ ...(queryObj || {}), page: prevPage }) });
		} else if (prevPage !== result[i - 1].page) {
			result.splice(i, 0, { separator: true });
		}
	}
	return result;
}

function buildNavigationData(opts) {
	const { cp, pc, pages, queryObj, previous, next } = opts || {};
	const data = { rel: [], pages: pages, currentPage: cp, pageCount: pc };
	const baseQuery = { ...(queryObj || {}) };
	delete baseQuery._;

	data.prev = { page: previous, active: cp > 1, qs: qs.stringify({ ...baseQuery, page: previous }) };
	data.next = { page: next, active: cp < pc, qs: qs.stringify({ ...baseQuery, page: next }) };
	data.first = { page: 1, active: cp === 1, qs: qs.stringify({ ...baseQuery, page: 1 }) };
	data.last = { page: pc, active: cp === pc, qs: qs.stringify({ ...baseQuery, page: pc }) };

	if (cp < pc) {
		data.rel.push({ rel: 'next', href: `?${qs.stringify({ ...baseQuery, page: next })}` });
	}
	if (cp > 1) {
		data.rel.push({ rel: 'prev', href: `?${qs.stringify({ ...baseQuery, page: previous })}` });
	}
	return data;
}

pagination.create = function (currentPage, pageCount, queryObj) {
	const normalized = normalizeCounts(currentPage, pageCount);
	if (normalized.trivial) {
		return {
			prev: { page: 1, active: currentPage > 1 },
			next: { page: 1, active: currentPage < pageCount },
			first: { page: 1, active: currentPage === 1 },
			last: { page: 1, active: currentPage === pageCount },
			rel: [],
			pages: [],
			currentPage: 1,
			pageCount: 1,
		};
	}

	const cp = normalized.currentPage;
	const pc = normalized.pageCount;
	const previous = Math.max(1, cp - 1);
	const next = Math.min(pc, cp + 1);

	const pagesToShow = computePagesToShow(cp, pc);
	let pages = buildPageObjects(pagesToShow, cp, queryObj);
	pages = insertSeparators(pages, queryObj);

	const data = buildNavigationData({ cp, pc, pages, queryObj, previous, next });
	return data;
};
