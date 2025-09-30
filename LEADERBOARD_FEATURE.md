# Student Contribution Leaderboard Feature

## Overview

This feature adds a contribution leaderboard to track student participation by counting their posts and topics within categories. This feature is only accessible to administrators.

## User Story

As a professor, I want to get data on how much each student commented and posted, so that I can see student participation and assign partial credit.

## Features

### 1. Global Leaderboard
- Shows all students' contributions across all categories
- Displays total posts and topics for each student
- Ranks students by total contributions (topics + posts)

### 2. Category-Specific Leaderboard
- Filter leaderboard by specific category
- Shows student contributions within the selected category only
- Easy category switching via dropdown selector

## Access Control

- **Admin Only**: This feature is only accessible to users with admin:categories privilege
- Accessible via: `/admin/manage/leaderboard`

## Implementation Details

### Backend Components

1. **Module**: `src/categories/leaderboard.js`
   - `Categories.getLeaderboard(cid, start, stop)` - Get category-specific leaderboard
   - `Categories.getGlobalLeaderboard(start, stop)` - Get global leaderboard

2. **Controller**: `src/controllers/admin/leaderboard.js`
   - Handles rendering of leaderboard page
   - Supports both global and category-specific views
   - Includes pagination (50 users per page)

3. **Routes**: Added to `src/routes/admin.js`
   - `/admin/manage/leaderboard` - Global leaderboard
   - `/admin/manage/leaderboard/:category_id` - Category-specific leaderboard

### Frontend Components

1. **Template**: `src/views/admin/manage/leaderboard.tpl`
   - Responsive table design
   - Shows rank, student name, topics, posts, and total contributions
   - Color-coded ranking badges (1st place: gold, 2-3: green, rest: gray)

2. **JavaScript**: `public/src/admin/manage/leaderboard.js`
   - Category selector integration
   - Handles category switching

3. **Language Files**: `public/language/en-GB/admin/manage/leaderboard.json`
   - English translations for UI labels

4. **Navigation**: Added to admin sidebar menu
   - Location: Admin Panel > Manage > Contribution Leaderboard

## Data Structure

Each leaderboard entry contains:
```javascript
{
  uid: 123,                    // User ID
  username: "student1",        // Username
  userslug: "student1",        // User slug
  picture: "/uploads/...",     // Profile picture URL
  postCount: 25,              // Number of posts/comments
  topicCount: 5,              // Number of topics created
  totalCount: 30,             // Total contributions (posts + topics)
  rank: 1                     // Leaderboard rank
}
```

## Usage

1. Navigate to Admin Panel
2. Go to Manage > Contribution Leaderboard
3. View global leaderboard or select a specific category from dropdown
4. Use pagination to browse through all students
5. Click on student names to view their profiles

## Technical Notes

- Post counts are retrieved from `cid:${cid}:uid:${uid}:pids` sorted sets
- Topic counts are retrieved from `cid:${cid}:uid:${uid}:tids` sorted sets
- Global counts use `users:postcount` and `uid:${uid}:topics` sets
- Rankings are calculated in real-time based on total contributions
- Pagination is set to 50 students per page
