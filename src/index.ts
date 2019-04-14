import * as Redux from 'redux';
const { diff, applyChange } = require('redux-state-diff');
import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const createType = (type: string) => `@@redux-persist/${type}`
const actionTypes = {
    CREATE: createType('CREATE'),
    CREATED: createType('CREATED'),
    LOAD: createType('LOAD'),
    LOADED: createType('LOADED'),
    UPDATE: createType('UPDATE'),
    UPDATED: createType('UPDATED'),
    DELETE: createType('DELETE'),
    DELETED: createType('DELETED')
}

const statusTypes = {
    CREATING: createType('CREATING'),
    LOADING: createType('LOADING'),
    UPDATING: createType('UPDATING'),
    DELETING: createType('DELETING'),
    IS_EMPTY: createType('IS_EMPTY'),
    UP_TO_DATE: createType('UP_TO_DATE'),
    COMPUTING: createType('COMPUTING'),
}

interface StorePersister {
    loadState(): Promise<any>;
    //saveAction(action: any): Promise<any>;
    saveState(state: any): Promise<any>;
}

interface MongoConfig {
    url: string
}


const State = new Schema({
    createdAt: Date,
    state: Object,
    index: Number
}, {timestamps: { createdAt: 'createdAt'}});

const stateModel = mongoose.model('State', State, 'base');

export class MongoStorePersister implements StorePersister {
    private index = 0;
    private lastState = null;
    private lastSavedState = null;
    private maxSmallDiffs = 5
    constructor(private config: MongoConfig) {}
    async loadState() {
        return mongoose.connect(this.config.url, { useNewUrlParser: true })
            .then(() => {
                return stateModel
                    .where('{ state: { $ne: undefined }}')
                    .sort({ index: -1, createdAt: -1})
                    .findOne()
                    .then((document) => {
                        const loadedState = document.state || undefined;
                        this.lastSavedState = loadedState;
                        this.lastState = loadedState;
                        return Promise.resolve(loadedState);
                    })
            })
    }

    async saveState(state: any) {
        return stateModel
            .create({state: state, index: ++this.index})
            .then(() => {
                return Promise.resolve(state);
            })
            .catch((error) => {
                console.log(error)
            })
    }

    // async saveAction(sction: any) {
    //     return actions
    //         .create(action)
    //         .then(() => {
    //             return Promise.resolve(state);
    //         })
    // }
}

export const createStorePersister = 
(persister: StorePersister) :Redux.StoreEnhancer =>
(createStore) =>
<S, A extends Redux.AnyAction>(reducer: Redux.Reducer<S, A>, preloadedState?: Redux.DeepPartial<S>) => {
    const store = createStore((state: S | undefined, action: A) => {
        if (action.type.indexOf('@@redux-persister/INIT') !== -1) {
            state = reducer(undefined, action);
        }
        if (action.type.indexOf(actionTypes.LOADED) !== -1) {
            state = reducer(action.state, action);;
        }
        //console.log('A:', action)
        const prevState = state;
        const nextState = reducer(state, action);
        //console.log('StateDiff: ', diff(prevState, nextState))
        return nextState
    });

    const adminStore = createStore((state = { status: statusTypes.IS_EMPTY }, action) => {
        switch (action.type) {
            case actionTypes.CREATE:
                return {...state, status: statusTypes.CREATING }

            case actionTypes.LOAD:
                return {...state, status: statusTypes.LOADING }
            
            case actionTypes.UPDATE:
                return {...state, status: statusTypes.UPDATING }

            case actionTypes.DELETE:
                return {...state, status: statusTypes.DELETING }

            case actionTypes.CREATED:
            case actionTypes.LOADED:
            case actionTypes.UPDATED:
                return {...state, status: statusTypes.UP_TO_DATE }

            case actionTypes.DELETED:
                return {...state, status: statusTypes.IS_EMPTY }
        
            default:
                return state;
        }
    })

    const dispatch = (action: A): any => {
        switch (action.type) {
            case actionTypes.CREATE:
                console.log('BLOCKING ACTION START:', adminStore.dispatch(action).type);
                // TODO create
                break;
            case actionTypes.LOAD:
                console.log('BLOCKING ACTION START:', adminStore.dispatch(action).type);
                persister.loadState()
                    .then((state) => dispatch(<A><unknown>{ type: actionTypes.LOADED, state: state }))
                break;
            case actionTypes.DELETE:
                // TODO delete
                console.log('BLOCKING ACTION START:', adminStore.dispatch(action).type);
                break;

            case actionTypes.CREATED:
            case actionTypes.LOADED:
                console.log('DISPATCH: ', store.dispatch(action).type); // TODO init 
                console.log('BLOCKING ACTION END:', adminStore.dispatch(action).type);
                console.log('STATE: ', store.getState())
                break;
            case actionTypes.UPDATED:
                console.log('NON-BLOCKING ACTION END: ', adminStore.dispatch(action).type);
                break;
            case actionTypes.DELETED:
                adminStore.dispatch(action);
                break;
    
            case actionTypes.UPDATE:
                console.log('NON-BLOCKING ACTION START: ', adminStore.dispatch(action).type);
                persister.saveState(store.getState())
                    .then(() => dispatch(<A><unknown>{ type: actionTypes.UPDATED}))
                break;
            default:
                switch (adminStore.getState().status) {
                    case statusTypes.CREATING:
                    case statusTypes.LOADING:
                    case statusTypes.DELETING:
                    case statusTypes.IS_EMPTY:
                        console.log('BLOCK ACTION ', action, 'because', adminStore.getState().status)
                        break;
                
                    default:
                        console.log('DISPATCH: ', store.dispatch(action).type);
                        console.log('STATE: ', store.getState())
                        dispatch(<A><unknown>{ type: actionTypes.UPDATE})
                        break;
                }
                break;
        }
        return action;
    }
    dispatch(<A>{ type: actionTypes.LOAD })
    return {
        ...store,
        dispatch: dispatch
    }
}
