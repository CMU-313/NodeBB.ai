<div class="px-lg-4">

	<div class="d-flex border-bottom py-2 m-0 sticky-top acp-page-main-header align-items-center justify-content-between flex-wrap gap-2">
		<div class="">
			<h4 class="fw-bold tracking-tight mb-0">[[admin/manage/leaderboard:title]]</h4>
		</div>
		<div class="d-flex gap-1">
			<!-- IMPORT admin/partials/category/selector-dropdown-right.tpl -->
			{{{ if category }}}
			<a href="{config.relative_path}/admin/manage/leaderboard" class="btn btn-ghost btn-sm">
				<i class="fa fa-fw fa-globe"></i> [[admin/manage/leaderboard:view-global]]
			</a>
			{{{ end }}}
		</div>
	</div>

	<div class="row">
		<div class="col-12">
			<div class="alert alert-info mt-3">
			{{{ if category }}}
				<p><strong>[[admin/manage/leaderboard:category-info, {category.name}]]</strong></p>
				<p>[[admin/manage/leaderboard:category-description]]</p>
			{{{ else }}}
				<p><strong>[[admin/manage/leaderboard:global-info]]</strong></p>
				<p>[[admin/manage/leaderboard:global-description]]</p>
			{{{ end }}}
			</div>
		</div>
	</div>

	<div class="row">
		<div class="col-12">
			<div class="card mt-3">
				<div class="card-header">
					<h5 class="card-title mb-0">
						{{{ if category }}}
						[[admin/manage/leaderboard:category-title, {category.name}]]
						{{{ else }}}
						[[admin/manage/leaderboard:global-title]]
						{{{ end }}}
					</h5>
				</div>
				<div class="card-body p-0">
					{{{ if leaderboard.length }}}
					<div class="table-responsive">
						<table class="table table-striped table-hover mb-0">
							<thead>
								<tr>
									<th class="text-center" style="width: 80px;">[[admin/manage/leaderboard:rank]]</th>
									<th>[[admin/manage/leaderboard:student]]</th>
									<th class="text-center" style="width: 120px;">[[admin/manage/leaderboard:topics]]</th>
									<th class="text-center" style="width: 120px;">[[admin/manage/leaderboard:posts]]</th>
									<th class="text-center" style="width: 120px;">[[admin/manage/leaderboard:total]]</th>
								</tr>
							</thead>
							<tbody>
								{{{ each leaderboard }}}
								<tr>
									<td class="text-center">
										{{{ if @first }}}
										<span class="badge text-bg-warning fs-6">#{@value.rank}</span>
										{{{ else }}}
										<span class="badge text-bg-secondary fs-6">#{@value.rank}</span>
										{{{ end }}}
									</td>
									<td>
										<div class="d-flex align-items-center gap-2">
											{{{ if @value.picture }}}
											<img src="{@value.picture}" class="avatar avatar-sm rounded-circle" alt="{@value.username}" />
											{{{ else }}}
											<div class="avatar avatar-sm rounded-circle" style="background-color: {@value.icon:bgColor};">{@value.icon:text}</div>
											{{{ end }}}
											<a href="{config.relative_path}/uid/{@value.uid}" target="_blank" class="fw-semibold text-decoration-none">
												{@value.username}
											</a>
										</div>
									</td>
									<td class="text-center">
										<span class="badge text-bg-primary">{@value.topicCount}</span>
									</td>
									<td class="text-center">
										<span class="badge text-bg-info">{@value.postCount}</span>
									</td>
									<td class="text-center">
										<strong class="fs-5">{@value.totalCount}</strong>
									</td>
								</tr>
								{{{ end }}}
							</tbody>
						</table>
					</div>
					{{{ else }}}
					<div class="p-4 text-center text-muted">
						<i class="fa fa-inbox fa-3x mb-3"></i>
						<p>[[admin/manage/leaderboard:no-data]]</p>
					</div>
					{{{ end }}}
				</div>
			</div>
		</div>
	</div>

	{{{ if pagination.pages.length > 1 }}}
	<div class="row">
		<div class="col-12">
			<!-- IMPORT partials/paginator.tpl -->
		</div>
	</div>
	{{{ end }}}

</div>
