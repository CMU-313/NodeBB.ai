<div data-widget-area="header">
	{{{each widgets.header}}}
	{{widgets.header.html}}
	{{{end}}}
</div>

<div class="row flex-fill">
	<div class="resources {{{if widgets.sidebar.length }}}col-lg-9 col-sm-12{{{ else }}}col-lg-12{{{ end }}}">
		<h3 class="fw-semibold">[[resources:title]]</h3>
		<hr/>
		
		{{{ if !resources.length }}}
		<div class="alert alert-warning">[[resources:no-resources]]</div>
		{{{ end }}}

		<ul class="list-group">
			{{{ each resources }}}
			<li class="list-group-item">
				<a href="{./url}" target="_blank" rel="noopener noreferrer" class="fw-bold">{./title}</a>
				<p class="mb-0 text-muted">{./description}</p>
			</li>
			{{{ end }}}
		</ul>
	</div>
	<div data-widget-area="sidebar" class="col-lg-3 col-sm-12 {{{ if !widgets.sidebar.length }}}hidden{{{ end }}}">
		{{{ each widgets.sidebar }}}
		{{widgets.sidebar.html}}
		{{{ end }}}
	</div>
</div>

<div data-widget-area="footer">
	{{{each widgets.footer}}}
	{{widgets.footer.html}}
	{{{end}}}
</div>
