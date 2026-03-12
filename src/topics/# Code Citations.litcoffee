# Code Citations

## License: GPL-3.0
https://github.com/NodeBB/NodeBB/blob/5d8a557199de6a607b4b9fbee27441657a69cbb4/src/topics/unread.js

```
const filterTags = params.tag && params.tag.map(tag => String(tag));

		topicData.forEach((topic) => {
			if (topic && topic.cid &&
				(!filterCids || filterCids.includes(topic.cid)) &&
				(!filterTags || filterTags.every(tag => topic.tags.find(topicTag => topicTag.value === tag))) &&
				!blockedUids.includes(topic.uid)) {
				if (isTopicsFollowed[topic.tid] ||
					[categories.watchStates.watching, categories.watchStates.tracking].includes(userCidState[topic.cid])) {
					tidsByFilter[''].push(topic.tid);
					unreadCids.push(topic.cid);
				}

				if (isTopicsFollowed[topic.tid]) {
					tidsByFilter.watched.push(topic.tid);
				}

				if (topic.postcount <= 1) {
					tidsByFilter.unreplied.push(topic.tid);
				}

				if (!userReadTimes[topic.tid]) {
					tidsByFilter.new.push(
```

