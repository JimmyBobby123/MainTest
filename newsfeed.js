const tester = ["Player SYD_1337 takes new world!", "War breaks out in Sector 57", "Large Fleet spotted in Sector 14", "Player George59 creates new Space Station!"]

export class NewsFeed {
    constructor() {
        //this.feed = [];
        this.feed = tester;
    }

    addToFeed(newFeed){
        this.feed.push(newFeed);
    }

    getAllFeed() {
        return this.feed;
    }
}
