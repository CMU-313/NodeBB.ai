<div component="poll-block" class="card p-3 mb-3">
	<h5 class="mb-2">{title}</h5>
	<ul class="list-unstyled mb-0">
		{{{ each options }}}
		<li class="mb-2">
			<button component="poll-option" data-option-id="{./id}" class="btn btn-outline-primary w-100 d-flex justify-content-between align-items-center">
				<span>{./text}</span>
				<span class="badge bg-secondary">{./votes}</span>
			</button>
		</li>
		{{{ end }}}
	</ul>
</div>
