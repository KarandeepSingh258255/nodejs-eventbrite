const POLL_MS = 60000;

function formatDate(eventTime) {
  if (!eventTime?.local) return 'Date TBD';
  const date = new Date(eventTime.local);
  if (Number.isNaN(date.getTime())) return 'Date TBD';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateParts(eventTime) {
  if (!eventTime?.local) return { day: '--', month: '---', year: '----' };
  const date = new Date(eventTime.local);
  if (Number.isNaN(date.getTime())) return { day: '--', month: '---', year: '----' };
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const year = String(date.getFullYear());
  return { day, month, year };
}

function formatTime(eventTime) {
  if (!eventTime?.local) return 'TBD';
  const date = new Date(eventTime.local);
  if (Number.isNaN(date.getTime())) return 'TBD';
  return date
    .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    .replace(' AM', 'am')
    .replace(' PM', 'pm');
}

function formatTimeRange(start, end) {
  const startTime = formatTime(start);
  const endTime = formatTime(end);
  if (startTime === 'TBD' && endTime === 'TBD') return 'Time TBD';
  if (endTime === 'TBD') return startTime;
  return `${startTime} - ${endTime}`;
}

function formatLocation(venue) {
  if (!venue?.address) return 'Location TBD';
  const parts = [
    venue.address.city,
    venue.address.region,
    venue.address.country,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : 'Location TBD';
}

function getDescriptionPreview(event) {
  const raw =
    event.summary ||
    event.description?.text ||
    event.description?.html ||
    '';
  const text = raw.replace(/<[^>]*>/g, '').trim();
  if (!text) {
    return { text: 'No description available.', truncated: false };
  }
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 30) {
    return { text, truncated: false };
  }
  return { text: `${words.slice(0, 30).join(' ')}...`, truncated: true };
}

function formatTicketInfo(event) {
  const capacity = Number.isFinite(event.capacity) ? ` Aú Capacity ${event.capacity}` : '';
  if (event.is_free === true) return `Tickets: Free RSVP${capacity}`;
  if (event.is_free === false) return `Tickets: Paid${capacity}`;
  return `Tickets: Info TBD${capacity}`;
}

function buildTile(event) {
  const dateParts = formatDateParts(event.start);
  const timeRange = formatTimeRange(event.start, event.end);
  const location = formatLocation(event.venue);
  const description = getDescriptionPreview(event);
  const name = event.name || 'Untitled Event';
  const detailUrl = `event-single.html?eventId=${encodeURIComponent(event.id)}`;
  const image =
    event.logo?.url ||
    event.logo?.original?.url ||
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=900&q=60';
  const titleHref = event.url || detailUrl;
  const monthYear = `${dateParts.month} ${dateParts.year}`;
  return `
        <div class="ce_event_wrap default_width">
          <img src="${image}" alt="${name}">
          <div class="ce_event_des_wrap default_width">
            <div class="ce_event_date"><span>${dateParts.day}</span>${monthYear}</div>
            <div class="ce_event_new_des">
              <h5><a href="${titleHref}"${event.url ? ' target="_blank" rel="noopener"' : ''}>${name}</a></h5>
              <ul>
                <li><i class="fa fa-clock-o"></i><a href="#">${timeRange}</a></li>
                <li><i class="fa fa-map-marker"></i><a href="#">${location}</a></li>
              </ul>
              <p>${description.text}</p>
            </div>
          </div>
        </div>
      `;
}

const DISPLAY_LIMIT = 3;
let upcomingVisible = DISPLAY_LIMIT;
let pastVisible = DISPLAY_LIMIT;
let eventsCache = [];
let loadMoreWired = false;

function renderEvents(events) {
  const upcomingContainer = document.getElementById('upcoming-events');
  const pastContainer = document.getElementById('past-events');
  const upcomingLoad = document.getElementById('upcoming-load');
  const pastLoad = document.getElementById('past-load');
  const now = new Date();

  const upcoming = [];
  const past = [];

  events.forEach((event) => {
    const startLocal = event.start?.local;
    const startDate = startLocal ? new Date(startLocal) : null;
    if (!startDate || Number.isNaN(startDate.getTime())) {
      upcoming.push(event);
      return;
    }
    if (startDate >= now) {
      upcoming.push(event);
    } else {
      past.push(event);
    }
  });

  if (!upcoming.length) {
    upcomingContainer.innerHTML = '<div class="empty">No upcoming Events</div>';
    upcomingLoad.hidden = true;
  } else {
    const upcomingSlice = upcoming.slice(0, upcomingVisible);
    upcomingContainer.innerHTML = upcomingSlice.map(buildTile).join('');
    upcomingLoad.hidden = upcomingVisible >= upcoming.length;
  }

  if (!past.length) {
    pastContainer.innerHTML = '<div class="empty">No past events yet.</div>';
    pastLoad.hidden = true;
  } else {
    const pastSlice = past.slice(0, pastVisible);
    pastContainer.innerHTML = pastSlice.map(buildTile).join('');
    pastLoad.hidden = pastVisible >= past.length;
  }
}

function wireLoadMore() {
  if (loadMoreWired) return;
  const upcomingLoad = document.getElementById('upcoming-load');
  const pastLoad = document.getElementById('past-load');
  upcomingLoad.addEventListener('click', () => {
    upcomingVisible += DISPLAY_LIMIT;
    renderEvents(eventsCache);
  });
  pastLoad.addEventListener('click', () => {
    pastVisible += DISPLAY_LIMIT;
    renderEvents(eventsCache);
  });
  loadMoreWired = true;
}

async function fetchEvents() {
  try {
    const res = await fetch('/events');
    if (!res.ok) throw new Error('Failed to load events');
    const data = await res.json();
    eventsCache = data.events || [];
    renderEvents(eventsCache);
    wireLoadMore();
  } catch (error) {
    const upcomingContainer = document.getElementById('upcoming-events');
    const pastContainer = document.getElementById('past-events');
    upcomingContainer.innerHTML = '<div class="empty">Error loading events.</div>';
    pastContainer.innerHTML = '';
  }
}

fetchEvents();
setInterval(fetchEvents, POLL_MS);
