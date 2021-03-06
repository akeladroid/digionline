/**
 * Ezt nem volt kedvem újraírni.
 * Majd talán egyszer ha ez is lehal :>
 *
 * Created by Ben
 * https://github.com/szabbenjamin/digionline
 */
import Common from "./common";
import CONFIG from "../config";
import {ChannelInterface} from "./digionline";
import Log from "./log";
import FileHandler from "./file";

const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const { window } = new JSDOM(`<!DOCTYPE html>`);
const $ = require('jquery')(window);
var request = require('request');
var request = request.defaults({jar: true});
const fs = require('fs');

/**
 * Olvasnivalók:
 * https://en.wikipedia.org/wiki/Electronic_program_guide
 * http://kodi.wiki/view/Add-on:IPTV_Simple_Client
 *
 */
class Epg {
    private channelEpgUrls : object = {};
    private channelTemplate : string;
    private programmeTemplate : string;
    private xmlContainer : string;
    private collectedChannels : Array<ChannelInterface> = [];


    constructor () {
        this.channelEpgUrls = {
            id40: 'https://musor.tv/heti/tvmusor/M2',
            id39: 'https://musor.tv/heti/tvmusor/M1',
            id43: 'https://musor.tv/heti/tvmusor/DUNA',
            id41: 'https://musor.tv/heti/tvmusor/M4_SPORT',
            id44: 'https://musor.tv/heti/tvmusor/DUNAWORLD',
            id132: 'https://musor.tv/heti/tvmusor/M5',
            id207: 'https://musor.tv/heti/tvmusor/NICKELODEON',
            id206: 'https://musor.tv/heti/tvmusor/FEM3',
            id208: 'https://musor.tv/heti/tvmusor/SUPERTV2',
            id10: 'https://musor.tv/heti/tvmusor/COMEDY',
            id34: 'https://musor.tv/heti/tvmusor/COOL',
            id32: 'https://musor.tv/heti/tvmusor/FILMPLUS',
            id220: 'https://musor.tv/heti/tvmusor/NATGEO',
            id29: 'https://musor.tv/heti/tvmusor/RTL2',
            id37: 'https://musor.tv/heti/tvmusor/RTL',
            id204: 'https://musor.tv/heti/tvmusor/TV2',
            id2: 'https://musor.tv/heti/tvmusor/HIT_MUSIC',
            id212: 'https://musor.tv/heti/tvmusor/IZAURA_TV',
            id222: 'https://musor.tv/heti/tvmusor/NATGEOWILD',
            id45: 'https://musor.tv/heti/tvmusor/HISTORYHD',
            id21: 'https://musor.tv/heti/tvmusor/VIASATNAT',
            id7: 'https://musor.tv/heti/tvmusor/DIGIANIMALWORLD',
            id35: 'https://musor.tv/heti/tvmusor/PARAMOUNT',
            id225: 'https://musor.tv/heti/tvmusor/PRIME',
            id12: 'https://musor.tv/heti/tvmusor/DIGILIFE',
            id130: 'https://musor.tv/heti/tvmusor/SPEKTRUM',
            id232: 'https://musor.tv/heti/tvmusor/FILMNOW',
            id1: 'https://musor.tv/heti/tvmusor/DIGIWORLD',
            id219: 'https://musor.tv/heti/tvmusor/RTL_SPIKE',
            id215: 'https://musor.tv/heti/tvmusor/TLC',
            id26: 'https://musor.tv/heti/tvmusor/DIGISPORT1',
            id27: 'https://musor.tv/heti/tvmusor/DIGISPORT2',
            id131: 'https://musor.tv/heti/tvmusor/DIGISPORT3',
            id205: 'https://musor.tv/heti/tvmusor/EUROSPORT',
            id4: 'https://musor.tv/heti/tvmusor/VIASATHIST',
            id211: 'https://musor.tv/heti/tvmusor/HUMOR_PLUSZ',
            id210: 'https://musor.tv/heti/tvmusor/EUROSPORT2',
            id227: 'https://musor.tv/heti/tvmusor/LICHI_TV',
            id23: 'https://musor.tv/heti/tvmusor/PAPRIKA',
            id42: 'https://musor.tv/heti/tvmusor/AMC',
            id216: 'https://musor.tv/heti/tvmusor/ZENEBUTIK',
            id217: 'https://musor.tv/heti/tvmusor/MTV_EURO',
            id213: 'https://musor.tv/heti/tvmusor/KIWI_TV',
            id214: 'https://musor.tv/heti/tvmusor/MOZI_PLUSZ',
            id203: 'https://musor.tv/heti/tvmusor/DISCOVERY',
            id118: 'https://musor.tv/heti/tvmusor/SPORT2',
            id126: 'https://musor.tv/heti/tvmusor/SPORT1',
            id5: 'https://musor.tv/heti/tvmusor/MUSICCHANNEL',
            id226: 'https://musor.tv/heti/tvmusor/MINIMAX',
            id228: 'https://musor.tv/heti/tvmusor/MTVHU'
        };

        /*
         * Template fájlok az xml generálásához
         */
        this.channelTemplate = '<channel id="id:id"><display-name lang="hu">:channelName</display-name></channel>\n';
        this.programmeTemplate = '<programme start=":start :startOffset" stop=":end :endOffset" channel="id:id"><title lang="hu">:programme</title></programme>\n';
        this.xmlContainer = '<?xml version="1.0" encoding="utf-8" ?><tv>:content</tv>';
    }

    public setChannels (channelList : Array<ChannelInterface>) : void {
        this.collectedChannels = channelList;
    }

    private getChannelEpgUrls () {
        return this.channelEpgUrls;
    }

    private getXmlContainer (content) {
        return this.xmlContainer
            .replace(':content', content);
    }

    private getChannelEpg (id, channelName) {
        var channel = this.channelTemplate
            .replace(':id', id)
            .replace(':channelName', channelName);

        return channel;
    }

    private _applyTimeZoneCorrection (originalDate) {
        let correctDate = new Date(originalDate);

        // időzóna korrekció
        const offset = Common.getStaticTimeZoneOffset();
        correctDate.setHours(correctDate.getHours() - 1);

        return correctDate;
    }

    private getProgrammeTemplate (id, start, end, programme) {
        var startCorrect = this._applyTimeZoneCorrection(start);

        var endCorrect = this._applyTimeZoneCorrection(end);

        // Nem lehet egyszerre egy csatornán egy másodpercben egy csatornának kezdete és vége, így kivontunk belőle 1 mp-et
        endCorrect.setMilliseconds(endCorrect.getMilliseconds() - 1000);

        return this.programmeTemplate
            .replace(':id', id)
            .replace(':start', this.formatDate(startCorrect))
            .replace(':end', this.formatDate(endCorrect))
            .replace(':programme', programme)
            .replace(':startOffset', '+0100')
            .replace(':endOffset', '+0100')
            ;
    }

    private formatDate (date) {
        let d       = new Date(date);
        let year    = d.getFullYear();
        let month : any   = d.getMonth()+1;
        let day : any    = d.getDate();
        let hour : any   = d.getHours();
        let minute : any = d.getMinutes();
        let second : any = d.getSeconds();

        if (month.toString().length == 1) {
            month = '0' + month;
        }
        if (day.toString().length == 1) {
            day = '0'+day;
        }
        if (hour.toString().length == 1) {
            hour = '0'+hour;
        }
        if (minute.toString().length == 1) {
            minute = '0'+minute;
        }
        if (second.toString().length == 1) {
            second = '0'+second;
        }

        return '' + year+month+day+hour+minute+second;
    }

    /**
     * Műsorok letöltése
     * @param epgUrl
     * @param cb
     */
    private loadEPG(epgUrl, cb) {
        let headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:24.0) Gecko/20100101 Firefox/24.0',
            'Content-Type' : 'application/x-www-form-urlencoded'
        };

        let shows = [];

        request.get(
            epgUrl,
            {
                headers: headers
            },
            function (error, response, body) {

                $.each($(body).find("section"), function(index, section) {
                    /* A honlap eme "ajánló" elemeit el kell, hogy kerüljük, külünben
                     * tetszőleges csatornákról kerülnének műsorok a listánkra! */
                    let suggestionsToBeIgnored = $(section).find('[class="rotated-text rotated-to-be-seen_internal"]').html();

                    if (typeof suggestionsToBeIgnored === 'undefined') {
                        $.each($(section).find('[itemtype="https://schema.org/BroadcastEvent"]'), function (index, program) {
                            let show = {
                                startDate: $(program).find('[itemprop="startDate"]').attr('content'),
                                name: $(program).find('[itemprop="name"] a').html(),
                                description: $(program).find('[itemprop="description"]').html()
                            };
                            show.toString = function() {
                                return "['" + show.startDate + "' '" + show.name + "' '" + show.description + "']";
                            };

                            /**
                             * duplikációk megszüntetése
                             */
                            for (let i = 0; i < shows.length; i++) {
                                let _startDate = shows[i].startDate;
                                if (_startDate === show.startDate) {
                                    return;
                                }
                            }

                            shows.push(show);
                        });
                    }
                });

                // Rendezés
                shows.sort(function (a, b) {
                    a = new Date(a.startDate);
                    b = new Date(b.startDate);
                    return a < b ? -1 : a > b ? 1 : 0;
                });

                cb(shows);
            });
    }

    /**
     * Elektronikus programujságot generálunk
     */
    public generateEpg() {
        const self = this;
        let epgChannels = '',
            epgPrograms = '',
            epgTimestampPath = './epg.timestamp',
            epgUrls     = this.getChannelEpgUrls();

        let lastUpgrade;
        try {
            lastUpgrade = new Date(fs.readFileSync(epgTimestampPath).toString());
        } catch (e) {
            lastUpgrade = new Date('2000-01-01');
        }

        // XML outdate idő órában számítva
        const diffTime = CONFIG.epg.timeout * 60 * 60;

        if (CONFIG.epg.forceUpdate) {
            Log.write('EPG kenyszeritett ujratoltese...');
        } else if (Common.diffTime(new Date(), lastUpgrade) < diffTime) {
            Log.write('EPG naprakesz');
            return;
        } else {
            Log.write('EPG ujratoltese...');
        }
        FileHandler.writeFile('./epg.xml', '');

        /**
         * XML legyártása
         */
        const writeXml = () => {
            let content = this.getXmlContainer(epgChannels + epgPrograms);
            fs.writeFileSync('./epg.xml', content);
            Log.write('epg.xml ujrairva');
        };

        let channel_list_temp = self.collectedChannels.slice(0);
        let progress = setInterval(() => {
            // Ha elfogyott vége a dalnak, mentjük az xml-t
            if (channel_list_temp.length === 0) {
                clearInterval(progress);
                writeXml();
                fs.writeFileSync(epgTimestampPath, (new Date()).toString());
                return;
            }

            let channelElement  = channel_list_temp.pop(),
                channelIndex    = channelElement.id,
                name            = channelElement.name,
                id              = `id${channelElement.id}`;

            Log.write(`EPG betoltese: ${name}...`)
            if (typeof epgUrls[id] !== 'undefined') {
                epgChannels += self.getChannelEpg(channelIndex, name);
                self.loadEPG(epgUrls[id], function (shows) {
                    for (let i = 0; i < shows.length; i++) {
                        let endStartDate = new Date(shows[i].startDate);
                        epgPrograms += self.getProgrammeTemplate(
                            channelIndex,
                            shows[i].startDate,
                            typeof shows[i+1] !== 'undefined'
                                ? shows[i+1].startDate : endStartDate.setHours(endStartDate.getHours() + 1),
                            shows[i].name + ' ' + shows[i].description
                        );
                    }
                });
            }
        }, 4 * 1000);

        /**
         * XML újragyártása beállított időközönként
         */
        setTimeout(function () {
            Log.write('XML ujragyartasa...');
            self.generateEpg();
        }, CONFIG.epg.timeout * 60 * 60 * 1000);
    }
}

export default Epg;
