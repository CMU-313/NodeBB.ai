<!-- BEGIN users -->
<li class="users-box registered-user" data-uid="{users.uid}">
	<a href="{config.relative_path}/user/{users.userslug}">{buildAvatar(users, "128px", true)}</a>
	
	<div class="user-info">
		<span>
			<i component="user/status" class="fa fa-circle status {users.status}" title="[[global:{users.status}]]"></i>
			<a href="{config.relative_path}/user/{users.userslug}">{users.username}</a>
		</span>
		<!-- IF users.helpfulnessScore -->
		<div class="helpfulness-info">
			{{{ if users.helpfulnessScore }}}
			<span class="badge rounded-pill bg-info" title="[[users:helpfulness-score, {users.helpfulnessScore}]]">
				<i class="fa fa-check-circle"></i> {users.helpfulnessScore}
			</span>
			{{{ end }}}
		</div>
		<!-- ENDIF users.helpfulnessScore -->
		<br/>

		<!-- IF route_users:joindate -->
		<div class="user-join-date">[[users:joined]] <span class="timeago" title="{users.joindateISO}"></span></div>
		<!-- ENDIF route_users:joindate -->

		<!-- IF route_users:reputation -->
		<div class="user-reputation">[[users:reputation]]: <span class="formatted-number">{users.reputation}</span></div>
		<!-- ENDIF route_users:reputation -->

		<!-- IF route_users:postcount -->
		<div class="user-postcount">[[users:posts]]: <span class="formatted-number">{users.postcount}</span></div>
		<!-- ENDIF route_users:postcount -->
		
		<!-- IF showHelpfulnessBadge -->
		{{{ if ./helpfulnessScore }}}
		<div class="user-helpfulness">
			[[users:helpful-posts]]: <span class="formatted-number">{./helpfulnessScore}</span>
		</div>
		{{{ end }}}
		<!-- ENDIF showHelpfulnessBadge -->
	</div>
</li>
<!-- END users -->