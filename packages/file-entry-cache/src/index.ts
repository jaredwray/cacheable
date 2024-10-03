import {FlatCache} from 'flat-cache';

export class FileEntryCache {
	cache: FlatCache;

	constructor() {
		this.cache = new FlatCache();
	}
}
