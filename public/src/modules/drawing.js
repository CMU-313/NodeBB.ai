(function () {
	'use strict';

	const canvas = document.getElementById('canvas');
	const ctx = canvas.getContext('2d');
	let drawing = false;
	let tool = 'pen';
	let size = 3;
	let color = '#000';
	let history = [];

	function resize() {
		canvas.width = window.innerWidth - 420;
		canvas.height = window.innerHeight - document.querySelector('.tools').offsetHeight;
		render();
	}

	function saveHistory() {
		history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
		if (history.length > 50) history.shift();
	}

	function undo() {
		if (!history.length) return;
		const img = history.pop();
		ctx.putImageData(img, 0, 0);
	}

	function render() {
		// no-op for now; canvas is immediate mode
	}

	function start(e) {
		drawing = true;
		saveHistory();
		ctx.beginPath();
		draw(e);
	}

	function stop() {
		drawing = false;
		ctx.closePath();
	}

	function getPos(e) {
		const rect = canvas.getBoundingClientRect();
		const clientX = e.touches ? e.touches[0].clientX : e.clientX;
		const clientY = e.touches ? e.touches[0].clientY : e.clientY;
		return { x: clientX - rect.left, y: clientY - rect.top };
	}

	function draw(e) {
		if (!drawing) return;
		const pos = getPos(e);
		ctx.lineWidth = size;
		ctx.lineCap = 'round';
		if (tool === 'eraser') {
			ctx.globalCompositeOperation = 'destination-out';
			ctx.strokeStyle = 'rgba(0,0,0,1)';
		} else {
			ctx.globalCompositeOperation = 'source-over';
			ctx.strokeStyle = color;
		}
		ctx.lineTo(pos.x, pos.y);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(pos.x, pos.y);
	}

	window.addEventListener('resize', resize);
	canvas.addEventListener('mousedown', start);
	canvas.addEventListener('touchstart', start);
	canvas.addEventListener('mouseup', stop);
	canvas.addEventListener('touchend', stop);
	canvas.addEventListener('mousemove', draw);
	canvas.addEventListener('touchmove', function (ev) { ev.preventDefault(); draw(ev); }, { passive: false });

	document.getElementById('pen').addEventListener('click', function () { tool = 'pen'; });
	document.getElementById('eraser').addEventListener('click', function () { tool = 'eraser'; });
	document.getElementById('clear').addEventListener('click', function () { ctx.clearRect(0, 0, canvas.width, canvas.height); history = []; });
	document.getElementById('undo').addEventListener('click', undo);
	document.getElementById('size').addEventListener('input', function (e) { size = parseInt(e.target.value, 10); });
	document.getElementById('color').addEventListener('input', function (e) { color = e.target.value; });

	document.getElementById('save').addEventListener('click', async function () {
		const status = document.getElementById('status');
		const result = document.getElementById('result');
		status.textContent = 'Preparing image...';
		result.style.display = 'none';
		canvas.toBlob(async function (blob) {
			if (!blob) { status.textContent = 'Failed to capture image'; return; }
			status.textContent = 'Uploading...';
			const filename = document.getElementById('filename').value || 'drawing.png';
			const form = new FormData();
			form.append('file', blob, filename);
			// Attach params expected by the server: route uses /api/post/upload
			try {
				const resp = await fetch('/api/post/upload', { method: 'POST', body: form, credentials: 'include' });
				if (!resp.ok) {
					const txt = await resp.text();
					status.textContent = 'Upload failed: ' + resp.status + ' ' + txt;
					return;
				}
				const json = await resp.json();
				const uploads = json.images || json.files || json;
				if (uploads && uploads.length) {
					const u = uploads[0];
					const markdown = (u.isImage ? '!' : '') + '[' + (u.filename || filename) + '](' + u.url + ')';
					result.textContent = markdown;
					result.style.display = 'block';
					status.textContent = 'Upload complete';
				} else {
					status.textContent = 'Upload returned unexpected response';
				}
			} catch (err) {
				status.textContent = 'Upload failed: ' + err.message;
			}
		}, 'image/png');
	});

	// initial setup
	resize();
	ctx.fillStyle = '#fff';
	ctx.fillRect(0, 0, canvas.width, canvas.height);

})();
