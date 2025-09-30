<!-- IMPORT partials/breadcrumbs.tpl -->

<div class="row">
	<div class="col-12">
		<h2 class="h4">[[topic:composer.new_topic]]</h2>
	</div>
</div>

<div class="topic-composer">
	<form id="compose-form" method="post">
		<div class="form-group">
			<input type="text" class="form-control" id="title" name="title" placeholder="[[topic:composer.title_placeholder]]" tabindex="1" />
		</div>

		<div class="form-group">
			<textarea class="form-control" id="content" name="content" placeholder="[[topic:composer.write]]" tabindex="2"></textarea>
		</div>

		<div class="form-group">
			<div class="d-flex align-items-center">
				<div class="checkbox pull-left">
					<label class="checkbox" for="anonymous">
						<input id="anonymous" name="anonymous" type="checkbox">
						[[topic:composer.anonymous]]
					</label>
				</div>
			</div>
		</div>

		<div class="form-group">
			<button type="submit" class="btn btn-primary" id="submit" tabindex="3">[[topic:composer.submit]]</button>
		</div>
	</form>
</div>

<div class="category-tag-row">
	<div class="btn-group">
		<button type="button" class="btn btn-primary dropdown-toggle" data-toggle="dropdown">
			<span class="visible-sm-inline visible-md-inline visible-lg-inline">[[topic:thread_tools.tools]]</span>
			<span class="caret"></span>
		</button>
		<ul class="dropdown-menu">
			<li><a href="#" class="composer-discard">[[topic:composer.discard]]</a></li>
		</ul>
	</div>
</div>

<div class="tag-row">
	<div class="tags-container">
		<input class="tags" type="text" class="form-control" placeholder="[[tags:enter_tags_here]]" tabindex="4"/></div>
	</div>
</div>

<!-- IMPORT partials/topic/category-selector.tpl -->