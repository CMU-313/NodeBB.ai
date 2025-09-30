<div class="card mb-3">
  <div class="card-body">
    <h5 class="card-title mb-2">[[topic:suggested-topics]]</h5>
    <ul class="list-unstyled mb-0">
      {{{ if suggestedTopics && suggestedTopics.length }}}
        {{{ each suggestedTopics }}}
          <li class="mb-2">
            <a href="{config.relative_path}/topic/{./slug}" class="text-decoration-none">{escape(./title)}</a>
            <div class="small text-muted">{timeAgo(./timestamp)}</div>
          </li>
        {{{ end }}}
      {{{ else }}}
        <li class="text-muted small">[[topic:no-suggested-topics]]</li>
      {{{ end }}}
    </ul>
  </div>
</div>
