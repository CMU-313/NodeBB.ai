<div class="container mt-4">
  <div class="row">
    <div class="col-12">
      <h1>Search Posts</h1>
      <form id="search-form">
        <div class="input-group mb-3">
          <input type="text" id="search-query" class="form-control" placeholder="Search for posts..." aria-label="Search for posts">
          <button class="btn btn-primary" type="submit">Search</button>
        </div>
      </form>
      <div id="search-results" class="mt-4">
        <!-- Search results will be dynamically inserted here -->
      </div>
    </div>
  </div>
</div>

<script>
  document.getElementById('search-form').addEventListener('submit', async function (e) {
    e.preventDefault();

    const query = document.getElementById('search-query').value;
    if (!query) {
      alert('Please enter a search query.');
      return;
    }

    const response = await fetch(`/api/search/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    const data = await response.json();
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '';

    if (data.posts && data.posts.length > 0) {
      data.posts.forEach(post => {
        const postElement = document.createElement('div');
        postElement.classList.add('card', 'mb-3');
        postElement.innerHTML = `
          <div class="card-body">
            <h5 class="card-title">${post.title || 'Untitled Post'}</h5>
            <p class="card-text">${post.content}</p>
            <p class="card-text"><small class="text-muted">By ${post.user.username}</small></p>
          </div>
        `;
        resultsContainer.appendChild(postElement);
      });
    } else {
      resultsContainer.innerHTML = '<p>No results found.</p>';
    }
  });
</script>