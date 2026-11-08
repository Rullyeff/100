import type { RoomSeat } from './room-types';
export function canJoinRoom(seats: RoomSeat[], area:number, started:boolean) {
 if(started) throw new Error('Permainan sudah dimulai.');
 if(seats.length>=5) throw new Error('Ruang sudah berisi lima pemain.');
 if(seats.some(s=>s.area===area)) throw new Error('Area sudah dipilih pemain lain.');
}
export function canStartRoom(seats: RoomSeat[],isHost:boolean) {
 if(!isHost) throw new Error('Hanya pembuat ruang dapat memulai.');
 if(seats.length!==5 || !seats.every(s=>s.ready)) throw new Error('Lima pemain harus siap.');
}