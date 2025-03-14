import { faker } from '@faker-js/faker';

interface User {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
}
interface Product {
	id: string;
	name: string;
	price: number;
	description: string;
}
interface Order {
	id: string;
	userId: string;
	productIds: string[];
	total: number;
	createdAt: Date;
}
interface Company {
	id: string;
	name: string;
	catchPhrase: string;
	bs: string;
}
interface Event {
	id: string;
	title: string;
	date: Date;
	location: string;
}
interface Review {
	id: string;
	productId: string;
	rating: number;
	comment: string;
}

interface Car {
	id: string;
	make: string;
	model: string;
	year: number;
}

interface Payment {
	id: string;
	orderId: string;
	amount: number;
	method: string;
	date: Date;
}

interface BlogPost {
	id: string;
	title: string;
	content: string;
	author: string;
	publishedAt: Date;
}

interface Comment {
	id: string;
	blogPostId: string;
	author: string;
	content: string;
	postedAt: Date;
}

export class ObjectGenerator {
	constructor() {
		// Initialize the object generator
	}

	public generateFakeUser(): User {
		return {
			id: faker.string.uuid(),
			firstName: faker.person.firstName(),
			lastName: faker.person.lastName(),
			email: faker.internet.email(),
		};
	}

	public generateFakeProduct(): Product {
		return {
			id: faker.string.uuid(),
			name: faker.commerce.productName(),
			price: parseFloat(faker.commerce.price()),
			description: faker.commerce.productDescription(),
		};
	}

	public generateFakeOrder(): Order {
		const productCount = faker.helpers.rangeToNumber({ min: 1, max: 5 });
		return {
			id: faker.string.uuid(),
			userId: faker.string.uuid(),
			productIds: Array.from({ length: productCount }, () => faker.string.uuid()),
			total: parseFloat(faker.commerce.price()),
			createdAt: faker.date.past(),
		};
	}

	public generateFakeCompany(): Company {
		return {
			id: faker.string.uuid(),
			name: faker.company.name(),
			catchPhrase: faker.company.catchPhrase(),
			bs: faker.company.buzzPhrase(),
		};
	}

	public generateFakeEvent(): Event {
		return {
			id: faker.string.uuid(),
			title: faker.lorem.words(3),
			date: faker.date.future(),
			location: `${faker.location.city()}, ${faker.location.country()}`,
		};
	}

	public generateFakeReview(): Review {
		return {
			id: faker.string.uuid(),
			productId: faker.string.uuid(),
			rating: faker.helpers.rangeToNumber({ min: 1, max: 5 }),
			comment: faker.lorem.sentence(),
		};
	}

	public generateFakeCar(): Car {
		return {
			id: faker.string.uuid(),
			make: faker.vehicle.manufacturer(),
			model: faker.vehicle.model(),
			year: parseInt(faker.date.past({ years: 30 }).getFullYear().toString()),
		};
	}

	public generateFakePayment(): Payment {
		return {
			id: faker.string.uuid(),
			orderId: faker.string.uuid(),
			amount: parseFloat(faker.commerce.price()),
			method: faker.finance.transactionType(),
			date: faker.date.recent(),
		};
	}

	public generateFakeBlogPost(): BlogPost {
		return {
			id: faker.string.uuid(),
			title: faker.lorem.sentence(),
			content: faker.lorem.paragraphs(2),
			author: faker.person.fullName(),
			publishedAt: faker.date.recent(),
		};
	}

	public generateFakeComment(): Comment {
		return {
			id: faker.string.uuid(),
			blogPostId: faker.string.uuid(),
			author: faker.person.fullName(),
			content: faker.lorem.sentence(),
			postedAt: faker.date.recent(),
		};
	}
}
