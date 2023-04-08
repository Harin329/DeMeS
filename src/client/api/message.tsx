const API_URL = '/api';

export const sendClientMessage = async (message: any) => {
    const response = await fetch(API_URL+'/clientMessage', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: message
        })
    });

    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }
};

export const getIsLeader = async () => {
    const response = await fetch(API_URL+'/isLeader');
    return response.json();
}

export const getPort = async () => {
    const response = await fetch(API_URL+'/port');
    return response.json();
}
