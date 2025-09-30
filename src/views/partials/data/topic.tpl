data-index="{posts.index}" data-pid="{posts.pid}" data-uid="{posts.uid}" data-timestamp="{posts.timestamp}" data-username="{posts.user.username}" data-userslug="{posts.user.userslug}"{{{ if posts.allowDupe }}} data-allow-dupe="1"{{{ end }}}{{{ if posts.navigatorIgnore }}} data-navigator-ignore="1"{{{ end }}} itemprop="comment" itemtype="http://schema.org/Comment" itemscope
<button 
	class="btn btn-sm btn-default post-mark-answered {{#posts.answered}}answered{{/posts.answered}}"
	component="post/mark-answered"
	data-pid="{posts.pid}">
	{{#posts.answered}}Unmark as Answered{{/posts.answered}}{{^posts.answered}}Mark as Answered{{/posts.answered}}
</button>