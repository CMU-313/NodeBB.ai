<!-- IMPORT partials/breadcrumbs-json-ld.tpl -->
{{{ if config.theme.enableBreadcrumbs }}}
<!-- IMPORT partials/breadcrumbs.tpl -->
{{{ end }}}

<div class="category-header d-flex flex-column gap-2">
	<div class="d-flex gap-2 align-items-center mb-1 {{{ if config.theme.centerHeaderElements }}}justify-content-center{{{ end }}}">
		{buildCategoryIcon(@value, "40px", "rounded-1 flex-shrink-0")}
		<h1 class="tracking-tight fs-2 fw-semibold mb-0">{./name}</h1>
	</div>
	{{{ if ./descriptionParsed }}}
	<div class="description text-secondary text-sm w-100 {{{ if config.theme.centerHeaderElements }}}text-center{{{ end }}} line-clamp-4 clamp-fade-4">
		{./descriptionParsed}
	</div>
	{{{ end }}}
	{{{ if ./handleFull }}}
	<p class="text-secondary text-sm fst-italic">
		[[category:handle.description, {handleFull}]]
		<a href="#" class="link-secondary" data-action="copy" data-clipboard-text="{handleFull}"><i class="fa fa-fw fa-copy" aria-hidden="true"></i></a>
	</p>
	{{{ end }}}
	<div class="d-flex flex-wrap gap-2 {{{ if config.theme.centerHeaderElements }}}justify-content-center{{{ end }}}">
		<span class="badge text-body border border-gray-300 stats text-xs">
			<span title="{totalTopicCount}" class="fw-bold">{humanReadableNumber(totalTopicCount)}</span>
			<span class="text-lowercase fw-normal">[[global:topics]]</span>
		</span>
		<span class="badge text-body border border-gray-300 stats text-xs">
			<span title="{totalPostCount}" class="fw-bold">{humanReadableNumber(totalPostCount)}</span>
			<span class="text-lowercase fw-normal">[[global:posts]]</span>
		</span>
	</div>
</div>

{{{ if widgets.header.length }}}
<div data-widget-area="header">
	{{{ each widgets.header }}}
	{{widgets.header.html}}
	{{{ end }}}
</div>
{{{ end }}}

{{{ if pinnedTopicContents.length }}}
<link rel="stylesheet" href="{config.relative_path}/css/pinned-topics.css">
<div class="pinned-topics-content mb-4">
	<div class="card border-0 shadow-sm">
		<div class="card-header bg-primary text-white">
			<h4 class="mb-0">
				<i class="fa fa-thumb-tack me-2"></i>
				[[category:pinned-topics]]
			</h4>
		</div>
		<div class="card-body">
			{{{ each pinnedTopicContents }}}
			<div class="pinned-topic-item mb-3 pb-3 {{{ if !@last }}}border-bottom{{{ end }}}">
				<div class="d-flex align-items-start gap-3">
					<div class="flex-shrink-0">
						{buildAvatar(pinnedTopicContents.user, "32px", true)}
					</div>
					<div class="flex-grow-1">
						<h5 class="mb-2">
							<a href="{config.relative_path}/topic/{pinnedTopicContents.slug}" class="text-decoration-none">
								{pinnedTopicContents.title}
							</a>
						</h5>
						<div class="pinned-content text-muted small">
							{pinnedTopicContents.content}
						</div>
						<div class="mt-1">
							<a href="{config.relative_path}/topic/{pinnedTopicContents.slug}" class="btn btn-sm btn-outline-primary">
								<i class="fa fa-arrow-right me-1"></i>
								Read More
							</a>
						</div>
						<div class="mt-2">
							<small class="text-muted">
								<i class="fa fa-user me-1"></i>
								{pinnedTopicContents.user.displayname}
								<span class="mx-2">•</span>
								<i class="fa fa-clock-o me-1"></i>
								<span class="timeago" title="{pinnedTopicContents.timestampISO}"></span>
							</small>
						</div>
					</div>
				</div>
			</div>
			{{{ end }}}
		</div>
	</div>
</div>
{{{ end }}}


<div class="row flex-fill mt-3">
	<div class="category d-flex flex-column {{{if widgets.sidebar.length }}}col-lg-9 col-sm-12{{{ else }}}col-lg-12{{{ end }}}">
		<!-- IMPORT partials/category/subcategory.tpl -->
		{{{ if (topics.length || privileges.topics:create) }}}
		<!-- IMPORT partials/topic-list-bar.tpl -->
		{{{ end }}}

		{{{ if (./inbox && (./hasFollowers == false)) }}}
		<div class="alert alert-warning mb-4" id="category-no-followers" data-bs-toggle="dropdown" data-bs-target='[component="topic/watch"] button' aria-hidden="true">
			<i class="fa fa-triangle-exclamation pe-2"></i>
			[[category:no-followers]]
			<a href="#" class="stretched-link"></a>
		</div>
		{{{ end }}}

		{{{ if (!topics.length && privileges.topics:create) }}}
		<div class="alert alert-info" id="category-no-topics">
			[[category:no-topics]]
		</div>
		{{{ end }}}

		<!-- IMPORT partials/topics_list.tpl -->

		{{{ if config.usePagination }}}
		<!-- IMPORT partials/paginator.tpl -->
		{{{ end }}}
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

{{{ if !config.usePagination }}}
<noscript>
	<!-- IMPORT partials/paginator.tpl -->
</noscript>
{{{ end }}}
