define('forum/postsearch', ['api', 'alerts'], function (api, alerts) {
define('forum/postsearch', ['api', 'alerts'], function (api, alerts) {
	const PostSearch = {};

	PostSearch.init = function () {
		const $input = $('#post-search-input');
		const $results = $('#post-search-results');
		if (!$input.length || !$results.length) return;

		$input.on('keyup', function () {
			const query = $input.val().trim();
			if (query.length < 2) {
				$results.empty();
				return;
			}
			api.get('/api/search', { term: query, in: 'posts', showAs: 'posts', searchOnly: 1 })
				.then(function (data) {
					$results.empty();
					if (data && data.posts && data.posts.length) {
						data.posts.slice(0, 10).forEach(function (post) {
							const html = `<div class="post-search-result"><a href="/post/${post.pid}">${post.content.slice(0, 100)}...</a></div>`;
							$results.append(html);
						});
					} else {
						$results.html('<div class="text-muted">No results</div>');
					}
				})
				.catch(alerts.error);
		});
	};

	return PostSearch;
});
