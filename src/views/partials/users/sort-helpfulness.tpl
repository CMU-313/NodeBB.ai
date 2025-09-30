<!-- IF loggedIn -->
<div class="btn-group bottom-sheet" component="sort/helpfulness">
	<button class="btn btn-default dropdown-toggle" data-bs-toggle="dropdown" type="button">
		<span component="sort/helpfulness/button">[[users:most-helpful]]</span> <span class="caret"></span>
	</button>
	<ul class="dropdown-menu dropdown-menu-end" role="menu">
		<li><a class="dropdown-item" href="#" data-sort="helpfulness" role="menuitem">[[users:most-helpful]]</a></li>
		<li><a class="dropdown-item" href="#" data-sort="recent" role="menuitem">[[users:recent]]</a></li>
		<li><a class="dropdown-item" href="#" data-sort="posts" role="menuitem">[[users:top-posters]]</a></li>
		<li><a class="dropdown-item" href="#" data-sort="reputation" role="menuitem">[[users:most-reputation]]</a></li>
	</ul>
</div>
<!-- ENDIF loggedIn -->