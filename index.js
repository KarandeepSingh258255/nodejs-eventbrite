// Load environment variables from a .env file
require('dotenv').config();
// Import the Axios library for making HTTP requests
const axios = require('axios');
const http = require('http');
const fs = require('fs');
const path = require('path');

function buildAxiosError(context, error) {
    if (error && error.response) {
        const status = error.response.status;
        const data = error.response.data;
        const err = new Error(`${context} failed (status ${status})`);
        err.status = status;
        err.data = data;
        return err;
    }
    if (error && error.request) {
        return new Error(`${context} failed (no response)`);
    }
    return new Error(`${context} failed (${error?.message || 'unknown error'})`);
}

// Function to retrieve a list of organizations associated with the user
async function getOrganizations(){
    try {
        // Making a GET request to the Eventbrite API to fetch organizations
        const organizations = await axios.get(`https://www.eventbriteapi.com/v3/users/me/organizations`, {
            headers: {
                'Authorization': `Bearer ${process.env.API_KEY}` // Authorization header with API key
            }
        });
        return organizations.data; // Returning the response data
    } catch(error) {
        throw buildAxiosError('getOrganizations', error);
    }
}

// Function to retrieve published (live) events for an organization
async function getPublishedEvents(organizationId){
    try {
        const events = await axios.get(`https://www.eventbriteapi.com/v3/organizations/${organizationId}/events/`, {
            params: {
                status: 'live',
                expand: 'logo,venue,organizer',
            },
            headers: {
                'Authorization': `Bearer ${process.env.API_KEY}`
            }
        });
        return events.data;
    } catch(error) {
        throw buildAxiosError('getPublishedEvents', error);
    }
}

// Function to retrieve a single event with expanded details
async function getEventById(eventId) {
    try {
        const event = await axios.get(`https://www.eventbriteapi.com/v3/events/${eventId}/`, {
            params: {
                expand: 'organizer,venue,logo,category,subcategory',
            },
            headers: {
                'Authorization': `Bearer ${process.env.API_KEY}`
            }
        });
        return event.data;
    } catch (error) {
        throw buildAxiosError('getEventById', error);
    }
}

// Function to retrieve published events across all organizations
async function getAllPublishedEvents(){
    const organizations = await getOrganizations();
    if (!organizations?.organizations?.length) {
        throw new Error('No organizations returned; check auth token and API response.');
    }
    const allEvents = [];
    for (const org of organizations.organizations) {
        const publishedEvents = await getPublishedEvents(org.id);
        if (publishedEvents?.events?.length) {
            for (const event of publishedEvents.events) {
                allEvents.push({
                    id: event.id,
                    name: event.name?.text,
                    url: event.url,
                    status: event.status,
                    start: event.start,
                    end: event.end,
                    organization_id: event.organization_id,
                    logo: event.logo,
                    description: event.description,
                    summary: event.summary,
                    venue: event.venue,
                    organizer: event.organizer,
                    is_free: event.is_free,
                    capacity: event.capacity,
                });
            }
        }
    }
    return allEvents;
}

// Function to create a new event
async function createEvent(organizationId, eventName, startDate, endDate, currency){
    try {
        // Making a POST request to the Eventbrite API to create an event
        const event = await axios.post(`https://www.eventbriteapi.com/v3/organizations/${organizationId}/events/`, {
            event: {
                name: {
                    html: eventName
                },
                start: {
                    "timezone": "America/Los_Angeles",
                    "utc": startDate
                },
                end: {
                    "timezone": "America/Los_Angeles",
                    "utc": endDate
                },
                currency,
            }
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.API_KEY}` // Authorization header with API key
            },
        });
        return event.data; // Returning the created event data
    } catch(error) {
        console.error('error', error); // Logging any errors encountered
    }
}

// Function to create ticket tiers for an event
async function createTicketsTiers(eventId){
    try {
        // Making a POST request to create a ticket tier
        const ticketsTier = await axios.post(`https://www.eventbriteapi.com/v3/events/${eventId}/inventory_tiers/`, {
            inventory_tier: {
                name: 'VIP',
                count_against_event_capacity: true,
                quantity_total: 30
            }
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.API_KEY}` // Authorization header with API key
            }
        });
        return ticketsTier.data; // Returning the created tickets tier data
    } catch(error) {
        console.error('error', error); // Logging any errors encountered
    }
}

// Function to assign ticket tiers to an event
async function assignTicketTiersToEvent(eventId, ticketTierId){
    try {
        // Making a POST request to assign ticket tiers to an event
        const ticketsAssigned = await axios.post(`https://www.eventbriteapi.com/v3/events/${eventId}/ticket_classes/`, {
            ticket_class: {
                name: "Vip section",
                free: false,
                donation: false,
                cost: "USD,1000",
                inventory_tier_id: ticketTierId
            }
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.API_KEY}` // Authorization header with API key
            }
        });
        return ticketsAssigned.data; // Returning the assigned ticket tier data
    } catch(error) {
        console.error('error', error); // Logging any errors encountered
    }
}

async function runSetupFlow(){
    const organizations = await getOrganizations(); // Fetching organizations
    if (!organizations?.organizations?.length) {
        throw new Error('No organizations returned; check auth token and API response.');
    }
    const existingEventId = process.env.EVENT_ID;
    let eventId;
    if (existingEventId) {
        eventId = existingEventId;
    } else {
        const eventCreated = await createEvent(
            organizations.organizations[0].id,
            'Coding With Ado MeetUP',
            new Date(new Date().getTime() + 15 * 60000).toISOString().replace(/\.\d{3}/, ''),
            new Date(new Date().getTime() + 30 * 60000).toISOString().replace(/\.\d{3}/, ''),
            'USD'
        );
        console.log(eventCreated);
        eventId = eventCreated.id;
    }
    const ticketTierCreated = await createTicketsTiers(eventId);
    console.log(ticketTierCreated);
    const ticketTierId = ticketTierCreated.inventory_tier_id ?? ticketTierCreated.inventory_tier?.id;
    const ticketsAssigned = await assignTicketTiersToEvent(eventId, ticketTierId);
    console.log(ticketsAssigned); // Logging the result of ticket assignment
}

function startServer(){
    const server = http.createServer(async (req, res) => {
        try {
            const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
            const pathname = url.pathname;

            if (pathname === '/' || pathname === '/index.html') {
                const htmlPath = path.join(__dirname, 'html.html');
                const html = fs.readFileSync(htmlPath, 'utf-8');
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(html);
                return;
            }
            if (pathname === '/event-single.html') {
                const htmlPath = path.join(__dirname, 'event-single.html');
                const html = fs.readFileSync(htmlPath, 'utf-8');
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(html);
                return;
            }
            if (pathname === '/events') {
                try {
                    const events = await getAllPublishedEvents();
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ events }));
                } catch (error) {
                    const status = Number.isInteger(error?.status) ? error.status : 502;
                    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({
                        error: error?.message || 'Failed to load events',
                        details: error?.data || null,
                    }));
                }
                return;
            }
            if (pathname === '/event') {
                const eventId = url.searchParams.get('eventId');
                if (!eventId) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: 'Missing eventId' }));
                    return;
                }
                const event = await getEventById(eventId);
                if (!event) {
                    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: 'Event not found' }));
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ event }));
                return;
            }
            if (
                pathname.startsWith('/css/') ||
                pathname.startsWith('/js/') ||
                pathname.startsWith('/images/') ||
                pathname.startsWith('/fonts/')
            ) {
                const filePath = path.resolve(__dirname, `.${pathname}`);
                if (!filePath.startsWith(__dirname)) {
                    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
                    res.end('Forbidden');
                    return;
                }
                if (!fs.existsSync(filePath)) {
                    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                    res.end('Not Found');
                    return;
                }
                const ext = path.extname(filePath).toLowerCase();
                const contentTypes = {
                    '.css': 'text/css; charset=utf-8',
                    '.js': 'application/javascript; charset=utf-8',
                    '.png': 'image/png',
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.gif': 'image/gif',
                    '.svg': 'image/svg+xml',
                    '.webp': 'image/webp',
                    '.ico': 'image/x-icon',
                    '.woff': 'font/woff',
                    '.woff2': 'font/woff2',
                    '.ttf': 'font/ttf',
                    '.eot': 'application/vnd.ms-fontobject',
                    '.map': 'application/json; charset=utf-8',
                };
                const contentType = contentTypes[ext] || 'application/octet-stream';
                const file = fs.readFileSync(filePath);
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(file);
                return;
            }
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not Found');
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Server error' }));
        }
    });

    const port = process.env.PORT || 3000;
    server.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}

const mode = process.env.MODE || 'server';
if (mode === 'setup') {
    runSetupFlow().catch((error) => console.error('error', error));
} else {
    startServer();
}
