// Load environment variables from a .env file
require('dotenv').config();
// Import the Axios library for making HTTP requests
const axios = require('axios');
const http = require('http');
const fs = require('fs');
const path = require('path');

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
        console.error('error', error); // Logging any errors encountered
    }
}

// Function to retrieve published (live) events for an organization
async function getPublishedEvents(organizationId){
    try {
        const events = await axios.get(`https://www.eventbriteapi.com/v3/organizations/${organizationId}/events/`, {
            params: {
                status: 'live',
            },
            headers: {
                'Authorization': `Bearer ${process.env.API_KEY}`
            }
        });
        return events.data;
    } catch(error) {
        console.error('error', error);
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
            if (req.url === '/' || req.url === '/index.html') {
                const htmlPath = path.join(__dirname, 'html.html');
                const html = fs.readFileSync(htmlPath, 'utf-8');
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(html);
                return;
            }
            if (req.url === '/events') {
                const events = await getAllPublishedEvents();
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ events }));
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
