document.addEventListener("DOMContentLoaded", () => {
  // DOM elements
  const activitiesList = document.getElementById("activities-list");
  const calendarView = document.getElementById("calendar-view");
  const cardViewButton = document.getElementById("card-view-button");
  const calendarViewButton = document.getElementById("calendar-view-button");
  const messageDiv = document.getElementById("message");
  const registrationModal = document.getElementById("registration-modal");
  const modalActivityName = document.getElementById("modal-activity-name");
  const signupForm = document.getElementById("signup-form");
  const activityInput = document.getElementById("activity");
  const closeRegistrationModal = document.querySelector(".close-modal");

  // Search and filter elements
  const searchInput = document.getElementById("activity-search");
  const searchButton = document.getElementById("search-button");
  const categoryFilters = document.querySelectorAll(".category-filter");
  const difficultyFilters = document.querySelectorAll(".difficulty-filter");
  const dayFilters = document.querySelectorAll(".day-filter");
  const timeFilters = document.querySelectorAll(".time-filter");

  // Authentication elements
  const loginButton = document.getElementById("login-button");
  const themeToggle = document.getElementById("theme-toggle");
  const userInfo = document.getElementById("user-info");
  const displayName = document.getElementById("display-name");
  const logoutButton = document.getElementById("logout-button");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const closeLoginModal = document.querySelector(".close-login-modal");
  const loginMessage = document.getElementById("login-message");

  function setTheme(theme) {
    const isDark = theme === "dark";
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    themeToggle.setAttribute("aria-pressed", String(isDark));
    themeToggle.setAttribute(
      "aria-label",
      `Switch to ${isDark ? "light" : "dark"} mode`
    );
    themeToggle.innerHTML = `<span aria-hidden="true">${
      isDark ? "☀️" : "🌙"
    }</span><span>${isDark ? "Light" : "Dark"} mode</span>`;
  }

  setTheme(localStorage.getItem("theme") === "dark" ? "dark" : "light");
  themeToggle.addEventListener("click", () => {
    const theme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(theme);
    localStorage.setItem("theme", theme);
  });

  // Current view mode: "card" (the default grid of cards) or "calendar"
  // (a weekly schedule grid). Remembered across visits like the theme is.
  let currentView =
    localStorage.getItem("activityView") === "calendar" ? "calendar" : "card";

  function setView(view) {
    currentView = view;
    localStorage.setItem("activityView", view);

    const isCalendar = view === "calendar";
    cardViewButton.classList.toggle("active", !isCalendar);
    cardViewButton.setAttribute("aria-pressed", String(!isCalendar));
    calendarViewButton.classList.toggle("active", isCalendar);
    calendarViewButton.setAttribute("aria-pressed", String(isCalendar));

    activitiesList.classList.toggle("hidden", isCalendar);
    calendarView.classList.toggle("hidden", !isCalendar);

    // Re-render whatever activities are currently loaded in the new view.
    displayFilteredActivities();
  }

  cardViewButton.addEventListener("click", () => setView("card"));
  calendarViewButton.addEventListener("click", () => setView("calendar"));
  // Apply a saved "calendar" preference without re-rendering yet (there is
  // nothing to render until fetchActivities() completes below).
  if (currentView === "calendar") {
    cardViewButton.classList.remove("active");
    cardViewButton.setAttribute("aria-pressed", "false");
    calendarViewButton.classList.add("active");
    calendarViewButton.setAttribute("aria-pressed", "true");
    activitiesList.classList.add("hidden");
    calendarView.classList.remove("hidden");
  }

  // Activity categories with corresponding colors
  const activityTypes = {
    sports: { label: "Sports", color: "#e8f5e9", textColor: "#2e7d32" },
    arts: { label: "Arts", color: "#f3e5f5", textColor: "#7b1fa2" },
    academic: { label: "Academic", color: "#e3f2fd", textColor: "#1565c0" },
    community: { label: "Community", color: "#fff3e0", textColor: "#e65100" },
    technology: { label: "Technology", color: "#e8eaf6", textColor: "#3949ab" },
  };

  // State for activities and filters
  let allActivities = {};
  let currentFilter = "all";
  let currentDifficulty = "all";
  let searchQuery = "";
  let currentDay = "";
  let currentTimeRange = "";

  // Authentication state
  let currentUser = null;

  // Time range mappings for the dropdown
  const timeRanges = {
    morning: { start: "06:00", end: "08:00" }, // Before school hours
    afternoon: { start: "15:00", end: "18:00" }, // After school hours
    weekend: { days: ["Saturday", "Sunday"] }, // Weekend days
  };

  // Initialize filters from active elements
  function initializeFilters() {
    // Initialize day filter
    const activeDayFilter = document.querySelector(".day-filter.active");
    if (activeDayFilter) {
      currentDay = activeDayFilter.dataset.day;
    }

    // Initialize time filter
    const activeTimeFilter = document.querySelector(".time-filter.active");
    if (activeTimeFilter) {
      currentTimeRange = activeTimeFilter.dataset.time;
    }
  }

  // Function to set day filter
  function setDayFilter(day) {
    currentDay = day;

    // Update active class
    dayFilters.forEach((btn) => {
      if (btn.dataset.day === day) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    fetchActivities();
  }

  // Function to set time range filter
  function setTimeRangeFilter(timeRange) {
    currentTimeRange = timeRange;

    // Update active class
    timeFilters.forEach((btn) => {
      if (btn.dataset.time === timeRange) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    fetchActivities();
  }

  // Check if user is already logged in (from localStorage)
  function checkAuthentication() {
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
      try {
        currentUser = JSON.parse(savedUser);
        updateAuthUI();
        // Verify the stored user with the server
        validateUserSession(currentUser.username);
      } catch (error) {
        console.error("Error parsing saved user", error);
        logout(); // Clear invalid data
      }
    }

    // Set authentication class on body
    updateAuthBodyClass();
  }

  // Validate user session with the server
  async function validateUserSession(username) {
    try {
      const response = await fetch(
        `/auth/check-session?username=${encodeURIComponent(username)}`
      );

      if (!response.ok) {
        // Session invalid, log out
        logout();
        return;
      }

      // Session is valid, update user data
      const userData = await response.json();
      currentUser = userData;
      localStorage.setItem("currentUser", JSON.stringify(userData));
      updateAuthUI();
    } catch (error) {
      console.error("Error validating session:", error);
    }
  }

  // Update UI based on authentication state
  function updateAuthUI() {
    if (currentUser) {
      loginButton.classList.add("hidden");
      userInfo.classList.remove("hidden");
      displayName.textContent = currentUser.display_name;
    } else {
      loginButton.classList.remove("hidden");
      userInfo.classList.add("hidden");
      displayName.textContent = "";
    }

    updateAuthBodyClass();
    // Refresh the activities to update the UI
    fetchActivities();
  }

  // Update body class for CSS targeting
  function updateAuthBodyClass() {
    if (currentUser) {
      document.body.classList.remove("not-authenticated");
    } else {
      document.body.classList.add("not-authenticated");
    }
  }

  // Login function
  async function login(username, password) {
    try {
      const response = await fetch(
        `/auth/login?username=${encodeURIComponent(
          username
        )}&password=${encodeURIComponent(password)}`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        showLoginMessage(
          data.detail || "Invalid username or password",
          "error"
        );
        return false;
      }

      // Login successful
      currentUser = data;
      localStorage.setItem("currentUser", JSON.stringify(data));
      updateAuthUI();
      closeLoginModalHandler();
      showMessage(`Welcome, ${currentUser.display_name}!`, "success");
      return true;
    } catch (error) {
      console.error("Error during login:", error);
      showLoginMessage("Login failed. Please try again.", "error");
      return false;
    }
  }

  // Logout function
  function logout() {
    currentUser = null;
    localStorage.removeItem("currentUser");
    updateAuthUI();
    showMessage("You have been logged out.", "info");
  }

  // Show message in login modal
  function showLoginMessage(text, type) {
    loginMessage.textContent = text;
    loginMessage.className = `message ${type}`;
    loginMessage.classList.remove("hidden");
  }

  // Open login modal
  function openLoginModal() {
    loginModal.classList.remove("hidden");
    loginModal.classList.add("show");
    loginMessage.classList.add("hidden");
    loginForm.reset();
  }

  // Close login modal
  function closeLoginModalHandler() {
    loginModal.classList.remove("show");
    setTimeout(() => {
      loginModal.classList.add("hidden");
      loginForm.reset();
    }, 300);
  }

  // Event listeners for authentication
  loginButton.addEventListener("click", openLoginModal);
  logoutButton.addEventListener("click", logout);
  closeLoginModal.addEventListener("click", closeLoginModalHandler);

  // Close login modal when clicking outside
  window.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      closeLoginModalHandler();
    }
  });

  // Handle login form submission
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    await login(username, password);
  });

  // Show loading skeletons
  function showLoadingSkeletons() {
    activitiesList.innerHTML = "";

    // Create more skeleton cards to fill the screen since they're smaller now
    for (let i = 0; i < 9; i++) {
      const skeletonCard = document.createElement("div");
      skeletonCard.className = "skeleton-card";
      skeletonCard.innerHTML = `
        <div class="skeleton-line skeleton-title"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line skeleton-text short"></div>
        <div style="margin-top: 8px;">
          <div class="skeleton-line" style="height: 6px;"></div>
          <div class="skeleton-line skeleton-text short" style="height: 8px; margin-top: 3px;"></div>
        </div>
        <div style="margin-top: auto;">
          <div class="skeleton-line" style="height: 24px; margin-top: 8px;"></div>
        </div>
      `;
      activitiesList.appendChild(skeletonCard);
    }
  }

  // Format schedule for display - handles both old and new format
  function formatSchedule(details) {
    // If schedule_details is available, use the structured data
    if (details.schedule_details) {
      if (!details.schedule_details.end_time) {
        return details.schedule;
      }

      const days = details.schedule_details.days.join(", ");

      // Convert 24h time format to 12h AM/PM format for display
      const formatTime = (time24) => {
        const [hours, minutes] = time24.split(":").map((num) => parseInt(num));
        const period = hours >= 12 ? "PM" : "AM";
        const displayHours = hours % 12 || 12; // Convert 0 to 12 for 12 AM
        return `${displayHours}:${minutes
          .toString()
          .padStart(2, "0")} ${period}`;
      };

      const startTime = formatTime(details.schedule_details.start_time);
      const endTime = formatTime(details.schedule_details.end_time);

      return `${days}, ${startTime} - ${endTime}`;
    }

    // Fallback to the string format if schedule_details isn't available
    return details.schedule;
  }

  // Function to determine activity type (this would ideally come from backend)
  function getActivityType(activityName, description) {
    const name = activityName.toLowerCase();
    const desc = description.toLowerCase();

    if (
      name.includes("soccer") ||
      name.includes("basketball") ||
      name.includes("sport") ||
      name.includes("fitness") ||
      desc.includes("team") ||
      desc.includes("game") ||
      desc.includes("athletic")
    ) {
      return "sports";
    } else if (
      name.includes("art") ||
      name.includes("music") ||
      name.includes("theater") ||
      name.includes("drama") ||
      desc.includes("creative") ||
      desc.includes("paint")
    ) {
      return "arts";
    } else if (
      name.includes("science") ||
      name.includes("math") ||
      name.includes("academic") ||
      name.includes("study") ||
      name.includes("olympiad") ||
      desc.includes("learning") ||
      desc.includes("education") ||
      desc.includes("competition")
    ) {
      return "academic";
    } else if (
      name.includes("volunteer") ||
      name.includes("community") ||
      desc.includes("service") ||
      desc.includes("volunteer")
    ) {
      return "community";
    } else if (
      name.includes("computer") ||
      name.includes("coding") ||
      name.includes("tech") ||
      name.includes("robotics") ||
      desc.includes("programming") ||
      desc.includes("technology") ||
      desc.includes("digital") ||
      desc.includes("robot")
    ) {
      return "technology";
    }

    // Default to "academic" if no match
    return "academic";
  }

  // Function to fetch activities from API with optional day and time filters
  async function fetchActivities() {
    // Show loading skeletons first
    showLoadingSkeletons();

    try {
      // Build query string with filters if they exist
      let queryParams = [];

      // Handle day filter
      if (currentDay) {
        queryParams.push(`day=${encodeURIComponent(currentDay)}`);
      }

      // Handle time range filter
      if (currentTimeRange) {
        const range = timeRanges[currentTimeRange];

        // Handle weekend special case
        if (currentTimeRange === "weekend") {
          // Don't add time parameters for weekend filter
          // Weekend filtering will be handled on the client side
        } else if (range) {
          // Add time parameters for before/after school
          queryParams.push(`start_time=${encodeURIComponent(range.start)}`);
          queryParams.push(`end_time=${encodeURIComponent(range.end)}`);
        }
      }

      const queryString =
        queryParams.length > 0 ? `?${queryParams.join("&")}` : "";
      const response = await fetch(`/activities${queryString}`);
      const activities = await response.json();

      // Save the activities data
      allActivities = activities;

      // Apply search and filter, and handle weekend filter in client
      displayFilteredActivities();
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Function to display filtered activities
  function displayFilteredActivities() {
    // Apply client-side filtering - this handles category filter and search, plus weekend filter
    let filteredActivities = {};

    Object.entries(allActivities).forEach(([name, details]) => {
      const activityType = getActivityType(name, details.description);

      // Apply category filter
      if (currentFilter !== "all" && activityType !== currentFilter) {
        return;
      }

      // The All difficulty option shows activities without a specified level.
      const activityDifficulty = details.difficulty || "all";
      if (activityDifficulty !== currentDifficulty) {
        return;
      }

      // Apply weekend filter if selected
      if (currentTimeRange === "weekend" && details.schedule_details) {
        const activityDays = details.schedule_details.days;
        const isWeekendActivity = activityDays.some((day) =>
          timeRanges.weekend.days.includes(day)
        );

        if (!isWeekendActivity) {
          return;
        }
      }

      // Apply search filter
      const searchableContent = [
        name.toLowerCase(),
        details.description.toLowerCase(),
        formatSchedule(details).toLowerCase(),
      ].join(" ");

      if (
        searchQuery &&
        !searchableContent.includes(searchQuery.toLowerCase())
      ) {
        return;
      }

      // Activity passed all filters, add to filtered list
      filteredActivities[name] = details;
    });

    if (currentView === "calendar") {
      renderCalendarView(filteredActivities);
    } else {
      renderCardView(filteredActivities);
    }
  }

  // Function to render the card-based activities list (the default view)
  function renderCardView(filteredActivities) {
    // Clear the activities list
    activitiesList.innerHTML = "";

    // Check if there are any results
    if (Object.keys(filteredActivities).length === 0) {
      activitiesList.innerHTML = `
        <div class="no-results">
          <h4>No activities found</h4>
          <p>Try adjusting your search or filter criteria</p>
        </div>
      `;
      return;
    }

    // Display filtered activities
    Object.entries(filteredActivities).forEach(([name, details]) => {
      renderActivityCard(name, details);
    });
  }

  // Days of the week for the calendar view, Sunday through Saturday,
  // matching the order requested in the calendar layout.
  const CALENDAR_DAYS = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  // Convert a "HH:MM" 24-hour time string into a count of minutes since midnight.
  function timeToMinutes(time24) {
    const [hours, minutes] = time24.split(":").map((num) => parseInt(num));
    return hours * 60 + minutes;
  }

  // Format a minutes-since-midnight value as a short hour label, e.g. "6 AM".
  function formatHourLabel(minutesSinceMidnight) {
    const hours = Math.floor(minutesSinceMidnight / 60) % 24;
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours} ${period}`;
  }

  // Given the activity entries scheduled on a single day (sorted by start
  // time), assign each one a column index and the total number of columns
  // used by its cluster of overlapping entries, so overlapping activities can
  // be shown side-by-side instead of stacked on top of each other.
  function layoutOverlappingEntries(dayEntries) {
    const positioned = [];
    let cluster = [];
    let clusterEnd = -Infinity;

    const finishCluster = () => {
      if (cluster.length === 0) {
        return;
      }
      // Greedily assign the earliest available column to each entry.
      const columnEndTimes = [];
      cluster.forEach((entry) => {
        let column = columnEndTimes.findIndex(
          (endTime) => endTime <= entry.startMinutes
        );
        if (column === -1) {
          column = columnEndTimes.length;
          columnEndTimes.push(entry.endMinutes);
        } else {
          columnEndTimes[column] = entry.endMinutes;
        }
        positioned.push({
          ...entry,
          column,
          totalColumns: columnEndTimes.length,
        });
      });
      // All entries in the cluster need to know the final column count.
      const totalColumns = columnEndTimes.length;
      for (let i = positioned.length - cluster.length; i < positioned.length; i++) {
        positioned[i].totalColumns = totalColumns;
      }
      cluster = [];
      clusterEnd = -Infinity;
    };

    dayEntries.forEach((entry) => {
      if (cluster.length > 0 && entry.startMinutes >= clusterEnd) {
        finishCluster();
      }
      cluster.push(entry);
      clusterEnd = Math.max(clusterEnd, entry.endMinutes);
    });
    finishCluster();

    return positioned;
  }

  // Pixels used to represent each minute of the calendar. Keeping this
  // consistent lets all the time math below stay in simple minute units.
  const CALENDAR_PX_PER_MINUTE = 1;
  // If an activity has no end time, assume it runs for this long.
  const CALENDAR_DEFAULT_DURATION_MINUTES = 60;

  // Function to render the weekly calendar view. Activities line up with
  // their scheduled start/end time, and overlapping activities on the same
  // day are shown side-by-side with reduced width.
  function renderCalendarView(filteredActivities) {
    calendarView.innerHTML = "";

    // Build a flat list of { name, details, day, startMinutes, endMinutes }
    // entries, one per day an activity meets on.
    const entries = [];
    Object.entries(filteredActivities).forEach(([name, details]) => {
      const scheduleDetails = details.schedule_details;
      if (!scheduleDetails || !scheduleDetails.days || !scheduleDetails.start_time) {
        return;
      }

      const startMinutes = timeToMinutes(scheduleDetails.start_time);
      const endMinutes = scheduleDetails.end_time
        ? timeToMinutes(scheduleDetails.end_time)
        : startMinutes + CALENDAR_DEFAULT_DURATION_MINUTES;

      scheduleDetails.days.forEach((day) => {
        if (!CALENDAR_DAYS.includes(day)) {
          return;
        }
        entries.push({ name, details, day, startMinutes, endMinutes });
      });
    });

    if (entries.length === 0) {
      calendarView.innerHTML = `
        <div class="no-results">
          <h4>No activities found</h4>
          <p>Try adjusting your search or filter criteria</p>
        </div>
      `;
      return;
    }

    // Round the visible time range out to the nearest hour so the grid lines
    // line up with the hour labels.
    const earliestStart = Math.min(...entries.map((entry) => entry.startMinutes));
    const latestEnd = Math.max(...entries.map((entry) => entry.endMinutes));
    const calendarStart = Math.floor(earliestStart / 60) * 60;
    const calendarEnd = Math.ceil(latestEnd / 60) * 60;
    const totalMinutes = calendarEnd - calendarStart;
    const gridHeight = totalMinutes * CALENDAR_PX_PER_MINUTE;

    const grid = document.createElement("div");
    grid.className = "calendar-grid";

    // Top-left empty corner above the time axis.
    const corner = document.createElement("div");
    corner.className = "calendar-corner";
    grid.appendChild(corner);

    // Day-of-week headers.
    CALENDAR_DAYS.forEach((day) => {
      const dayHeader = document.createElement("div");
      dayHeader.className = "calendar-day-header";
      dayHeader.textContent = day;
      grid.appendChild(dayHeader);
    });

    // Time-of-day axis on the left.
    const timeAxis = document.createElement("div");
    timeAxis.className = "calendar-time-axis";
    timeAxis.style.height = `${gridHeight}px`;
    for (let minutes = calendarStart; minutes <= calendarEnd; minutes += 60) {
      const label = document.createElement("div");
      label.className = "calendar-time-label";
      label.style.top = `${(minutes - calendarStart) * CALENDAR_PX_PER_MINUTE}px`;
      label.textContent = formatHourLabel(minutes);
      timeAxis.appendChild(label);
    }
    grid.appendChild(timeAxis);

    // One column per day of the week.
    CALENDAR_DAYS.forEach((day) => {
      const column = document.createElement("div");
      column.className = "calendar-day-column";
      column.style.height = `${gridHeight}px`;

      // Hour gridlines to help line up activities with their time.
      for (let minutes = calendarStart; minutes <= calendarEnd; minutes += 60) {
        const hourLine = document.createElement("div");
        hourLine.className = "calendar-hour-line";
        hourLine.style.top = `${(minutes - calendarStart) * CALENDAR_PX_PER_MINUTE}px`;
        column.appendChild(hourLine);
      }

      const dayEntries = entries
        .filter((entry) => entry.day === day)
        .sort((a, b) => a.startMinutes - b.startMinutes);
      const positionedEntries = layoutOverlappingEntries(dayEntries);

      positionedEntries.forEach((entry) => {
        column.appendChild(createCalendarEventElement(entry, calendarStart));
      });

      grid.appendChild(column);
    });

    calendarView.appendChild(grid);
  }

  // Build the DOM element for a single activity block on the calendar.
  function createCalendarEventElement(entry, calendarStart) {
    const { name, details, startMinutes, endMinutes, column, totalColumns } =
      entry;

    const totalSpots = details.max_participants;
    const takenSpots = details.participants.length;
    const activityType = getActivityType(name, details.description);
    const typeInfo = activityTypes[activityType];

    const top = (startMinutes - calendarStart) * CALENDAR_PX_PER_MINUTE;
    const height = Math.max(
      (endMinutes - startMinutes) * CALENDAR_PX_PER_MINUTE,
      20
    );
    const widthPercent = 100 / totalColumns;
    const leftPercent = widthPercent * column;

    const event = document.createElement("div");
    event.className = "calendar-event tooltip";
    event.style.top = `${top}px`;
    event.style.height = `${height}px`;
    event.style.left = `calc(${leftPercent}% + 2px)`;
    event.style.width = `calc(${widthPercent}% - 4px)`;
    event.style.backgroundColor = typeInfo.color;
    event.style.color = typeInfo.textColor;
    event.style.borderColor = typeInfo.textColor;

    event.innerHTML = `
      <span class="calendar-event-name">${name}</span>
      <span class="calendar-event-enrollment">${takenSpots}/${totalSpots} enrolled</span>
      <span class="tooltip-text">
        <strong>${name}</strong><br />
        ${details.description}<br />
        ${formatSchedule(details)}<br />
        ${takenSpots}/${totalSpots} enrolled
      </span>
    `;

    return event;
  }

  // Function to render a single activity card
  function renderActivityCard(name, details) {
    const activityCard = document.createElement("div");
    activityCard.className = "activity-card";

    // Calculate spots and capacity
    const totalSpots = details.max_participants;
    const takenSpots = details.participants.length;
    const spotsLeft = totalSpots - takenSpots;
    const capacityPercentage = (takenSpots / totalSpots) * 100;
    const isFull = spotsLeft <= 0;

    // Determine capacity status class
    let capacityStatusClass = "capacity-available";
    if (isFull) {
      capacityStatusClass = "capacity-full";
    } else if (capacityPercentage >= 75) {
      capacityStatusClass = "capacity-near-full";
    }

    // Determine activity type
    const activityType = getActivityType(name, details.description);
    const typeInfo = activityTypes[activityType];

    // Format the schedule using the new helper function
    const formattedSchedule = formatSchedule(details);

    // Create activity tag
    const tagHtml = `
      <span class="activity-tag" style="background-color: ${typeInfo.color}; color: ${typeInfo.textColor}">
        ${typeInfo.label}
      </span>
    `;

    // Create share buttons so students/teachers can share the activity
    const shareHtml = createShareButtonsHtml(name, details);

    // Create capacity indicator
    const capacityIndicator = `
      <div class="capacity-container ${capacityStatusClass}">
        <div class="capacity-bar-bg">
          <div class="capacity-bar-fill" style="width: ${capacityPercentage}%"></div>
        </div>
        <div class="capacity-text">
          <span>${takenSpots} enrolled</span>
          <span>${spotsLeft} spots left</span>
        </div>
      </div>
    `;

    activityCard.innerHTML = `
      ${tagHtml}
      <h4>${name}</h4>
      <p>${details.description}</p>
      <p class="tooltip">
        <strong>Schedule:</strong> ${formattedSchedule}
        <span class="tooltip-text">Regular meetings at this time throughout the semester</span>
      </p>
      ${capacityIndicator}
      ${shareHtml}
      <div class="participants-list">
        <h5>Current Participants:</h5>
        <ul>
          ${details.participants
            .map(
              (email) => `
            <li>
              ${email}
              ${
                currentUser
                  ? `
                <span class="delete-participant tooltip" data-activity="${name}" data-email="${email}">
                  ✖
                  <span class="tooltip-text">Unregister this student</span>
                </span>
              `
                  : ""
              }
            </li>
          `
            )
            .join("")}
        </ul>
      </div>
      <div class="activity-card-actions">
        ${
          currentUser
            ? `
          <button class="register-button" data-activity="${name}" ${
                isFull ? "disabled" : ""
              }>
            ${isFull ? "Activity Full" : "Register Student"}
          </button>
        `
            : `
          <div class="auth-notice">
            Teachers can register students.
          </div>
        `
        }
      </div>
    `;

    // Add click handlers for share buttons
    const shareButtons = activityCard.querySelectorAll(".share-button");
    shareButtons.forEach((button) => {
      button.addEventListener("click", () => handleShareClick(button, name));
    });

    // Add click handlers for delete buttons
    const deleteButtons = activityCard.querySelectorAll(".delete-participant");
    deleteButtons.forEach((button) => {
      button.addEventListener("click", handleUnregister);
    });

    // Add click handler for register button (only when authenticated)
    if (currentUser) {
      const registerButton = activityCard.querySelector(".register-button");
      if (!isFull) {
        registerButton.addEventListener("click", () => {
          openRegistrationModal(name);
        });
      }
    }

    activitiesList.appendChild(activityCard);
  }

  // Build the shareable URL and text for a given activity
  function getShareDetails(name, details) {
    const shareUrl = `${window.location.origin}${window.location.pathname}?activity=${encodeURIComponent(
      name
    )}`;
    const shareText = `Check out "${name}" at Mergington High School: ${details.description}`;
    return { shareUrl, shareText };
  }

  // Create the HTML markup for the share buttons on an activity card
  function createShareButtonsHtml(name, details) {
    return `
      <div class="share-container">
        <span class="share-label">Share:</span>
        <div class="share-buttons">
          <button
            type="button"
            class="share-button share-twitter"
            data-network="twitter"
            title="Share on X (Twitter)"
            aria-label="Share on X (Twitter)"
          >𝕏</button>
          <button
            type="button"
            class="share-button share-facebook"
            data-network="facebook"
            title="Share on Facebook"
            aria-label="Share on Facebook"
          >📘</button>
          <button
            type="button"
            class="share-button share-whatsapp"
            data-network="whatsapp"
            title="Share on WhatsApp"
            aria-label="Share on WhatsApp"
          >💬</button>
          <button
            type="button"
            class="share-button share-email"
            data-network="email"
            title="Share by Email"
            aria-label="Share by Email"
          >✉️</button>
          <button
            type="button"
            class="share-button share-copy"
            data-network="copy"
            title="Copy Link"
            aria-label="Copy Link"
          >🔗</button>
        </div>
      </div>
    `;
  }

  // Handle a click on any of the share buttons for an activity
  function handleShareClick(button, name) {
    const details = allActivities[name];
    if (!details) {
      return;
    }

    const network = button.dataset.network;
    const { shareUrl, shareText } = getShareDetails(name, details);

    let shareLink = "";
    switch (network) {
      case "twitter":
        shareLink = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
          shareText
        )}&url=${encodeURIComponent(shareUrl)}`;
        break;
      case "facebook":
        shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
          shareUrl
        )}`;
        break;
      case "whatsapp":
        shareLink = `https://wa.me/?text=${encodeURIComponent(
          `${shareText} ${shareUrl}`
        )}`;
        break;
      case "email":
        shareLink = `mailto:?subject=${encodeURIComponent(
          `Join me for ${name}!`
        )}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`;
        break;
      case "copy":
        copyShareLink(shareUrl);
        return;
      default:
        return;
    }

    window.open(shareLink, "_blank", "noopener,noreferrer");
  }

  // Copy the share link to the clipboard and let the user know it worked
  function copyShareLink(shareUrl) {
    const fallbackCopy = () => {
      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand("copy");
        showMessage("Activity link copied to clipboard!", "success");
      } catch (error) {
        showMessage("Unable to copy link. Please copy it manually.", "error");
      }
      document.body.removeChild(textarea);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(shareUrl)
        .then(() => {
          showMessage("Activity link copied to clipboard!", "success");
        })
        .catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
  }

  // Event listeners for search and filter
  searchInput.addEventListener("input", (event) => {
    searchQuery = event.target.value;
    displayFilteredActivities();
  });

  searchButton.addEventListener("click", (event) => {
    event.preventDefault();
    searchQuery = searchInput.value;
    displayFilteredActivities();
  });

  // Add event listeners to category filter buttons
  categoryFilters.forEach((button) => {
    button.addEventListener("click", () => {
      // Update active class
      categoryFilters.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      // Update current filter and display filtered activities
      currentFilter = button.dataset.category;
      displayFilteredActivities();
    });
  });

  // Add event listeners to difficulty filter buttons
  difficultyFilters.forEach((button) => {
    button.addEventListener("click", () => {
      difficultyFilters.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      currentDifficulty = button.dataset.difficulty;
      displayFilteredActivities();
    });
  });

  // Add event listeners to day filter buttons
  dayFilters.forEach((button) => {
    button.addEventListener("click", () => {
      // Update active class
      dayFilters.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      // Update current day filter and fetch activities
      currentDay = button.dataset.day;
      fetchActivities();
    });
  });

  // Add event listeners for time filter buttons
  timeFilters.forEach((button) => {
    button.addEventListener("click", () => {
      // Update active class
      timeFilters.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      // Update current time filter and fetch activities
      currentTimeRange = button.dataset.time;
      fetchActivities();
    });
  });

  // Open registration modal
  function openRegistrationModal(activityName) {
    modalActivityName.textContent = activityName;
    activityInput.value = activityName;
    registrationModal.classList.remove("hidden");
    // Add slight delay to trigger animation
    setTimeout(() => {
      registrationModal.classList.add("show");
    }, 10);
  }

  // Close registration modal
  function closeRegistrationModalHandler() {
    registrationModal.classList.remove("show");
    setTimeout(() => {
      registrationModal.classList.add("hidden");
      signupForm.reset();
    }, 300);
  }

  // Event listener for close button
  closeRegistrationModal.addEventListener(
    "click",
    closeRegistrationModalHandler
  );

  // Close modal when clicking outside of it
  window.addEventListener("click", (event) => {
    if (event.target === registrationModal) {
      closeRegistrationModalHandler();
    }
  });

  // Create and show confirmation dialog
  function showConfirmationDialog(message, confirmCallback) {
    // Create the confirmation dialog if it doesn't exist
    let confirmDialog = document.getElementById("confirm-dialog");
    if (!confirmDialog) {
      confirmDialog = document.createElement("div");
      confirmDialog.id = "confirm-dialog";
      confirmDialog.className = "modal hidden";
      confirmDialog.innerHTML = `
        <div class="modal-content">
          <h3>Confirm Action</h3>
          <p id="confirm-message"></p>
          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
            <button id="cancel-button" class="cancel-btn">Cancel</button>
            <button id="confirm-button" class="confirm-btn">Confirm</button>
          </div>
        </div>
      `;
      document.body.appendChild(confirmDialog);

      // Style the buttons
      const cancelBtn = confirmDialog.querySelector("#cancel-button");
      const confirmBtn = confirmDialog.querySelector("#confirm-button");

      cancelBtn.style.backgroundColor = "#f1f1f1";
      cancelBtn.style.color = "#333";

      confirmBtn.style.backgroundColor = "#dc3545";
      confirmBtn.style.color = "white";
    }

    // Set the message
    const confirmMessage = document.getElementById("confirm-message");
    confirmMessage.textContent = message;

    // Show the dialog
    confirmDialog.classList.remove("hidden");
    setTimeout(() => {
      confirmDialog.classList.add("show");
    }, 10);

    // Handle button clicks
    const cancelButton = document.getElementById("cancel-button");
    const confirmButton = document.getElementById("confirm-button");

    // Remove any existing event listeners
    const newCancelButton = cancelButton.cloneNode(true);
    const newConfirmButton = confirmButton.cloneNode(true);
    cancelButton.parentNode.replaceChild(newCancelButton, cancelButton);
    confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);

    // Add new event listeners
    newCancelButton.addEventListener("click", () => {
      confirmDialog.classList.remove("show");
      setTimeout(() => {
        confirmDialog.classList.add("hidden");
      }, 300);
    });

    newConfirmButton.addEventListener("click", () => {
      confirmCallback();
      confirmDialog.classList.remove("show");
      setTimeout(() => {
        confirmDialog.classList.add("hidden");
      }, 300);
    });

    // Close when clicking outside
    confirmDialog.addEventListener("click", (event) => {
      if (event.target === confirmDialog) {
        confirmDialog.classList.remove("show");
        setTimeout(() => {
          confirmDialog.classList.add("hidden");
        }, 300);
      }
    });
  }

  // Handle unregistration with confirmation
  async function handleUnregister(event) {
    // Check if user is authenticated
    if (!currentUser) {
      showMessage(
        "You must be logged in as a teacher to unregister students.",
        "error"
      );
      return;
    }

    const activity = event.target.dataset.activity;
    const email = event.target.dataset.email;

    // Show confirmation dialog
    showConfirmationDialog(
      `Are you sure you want to unregister ${email} from ${activity}?`,
      async () => {
        try {
          const response = await fetch(
            `/activities/${encodeURIComponent(
              activity
            )}/unregister?email=${encodeURIComponent(
              email
            )}&teacher_username=${encodeURIComponent(currentUser.username)}`,
            {
              method: "POST",
            }
          );

          const result = await response.json();

          if (response.ok) {
            showMessage(result.message, "success");
            // Refresh the activities list
            fetchActivities();
          } else {
            showMessage(result.detail || "An error occurred", "error");
          }
        } catch (error) {
          showMessage("Failed to unregister. Please try again.", "error");
          console.error("Error unregistering:", error);
        }
      }
    );
  }

  // Show message function
  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.classList.remove("hidden");

    // Hide message after 5 seconds
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    // Check if user is authenticated
    if (!currentUser) {
      showMessage(
        "You must be logged in as a teacher to register students.",
        "error"
      );
      return;
    }

    const email = document.getElementById("email").value;
    const activity = activityInput.value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(
          email
        )}&teacher_username=${encodeURIComponent(currentUser.username)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        closeRegistrationModalHandler();
        // Refresh the activities list after successful signup
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  // Expose filter functions to window for future UI control
  window.activityFilters = {
    setDayFilter,
    setTimeRangeFilter,
  };

  // Initialize app
  checkAuthentication();
  initializeFilters();
  fetchActivities();
});
