'use strict';

define('forum/staff-filter', [], function () {
	const StaffFilter = {};

	StaffFilter.init = function () {
		const filterBtn = document.getElementById('staff-filter-btn');
		if (filterBtn) {
			filterBtn.addEventListener('click', function () {
				const isActive = filterBtn.classList.contains('active');
				filterBtn.classList.toggle('active');
				filterBtn.innerHTML = isActive ? 'Show All Posts' : 'Show Staff Posts Only';
				
				// Reload the page with the filter
				const url = new URL(window.location.href);
				if (!isActive) {
					url.searchParams.set('staff', '1');
				} else {
					url.searchParams.delete('staff');
				}
				window.location.href = url.toString();
			});
		}
	};

	return StaffFilter;
});