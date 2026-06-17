export type Action = { id: string; name: string };
export type Device = {
  id: string;
  name: string;
  icon?: string;
  type: "air_conditioner" | "smart_switch" | "smart_light" | string;
  actions: Action[];
  state?: string;
  online?: boolean;
};
export type Room = {
  id: string;
  name: string;
  icon?: string;
  temperature?: number;
  humidity?: number;
  devices: Device[];
};
export type Home = {
  pageTitle?: string;
  name: string;
  subTitle?: string;
  logo?: string;
  rooms: Room[];
};
