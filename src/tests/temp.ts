import { createStore } from 'redux';
import { createStorePersister, MongoStorePersister } from '../index';

const store = createStore((state: {count: number} = { count: 0}, action) => {
    let newState = state;
    if (action.type === '++') {
        newState = {...state, count: state.count + 1}
    }
    return newState;
},
createStorePersister(new MongoStorePersister({
    url: 'mongodb://localhost/test'
})))


store.dispatch({type: '++'})
store.dispatch({type: '++'})
store.dispatch({type: '++'})
store.dispatch({type: '++'})
store.dispatch({type: '++'})

setTimeout(() => {
    console.log('............')
store.dispatch({type: '++'})
store.dispatch({type: '++'})
store.dispatch({type: '++'})
store.dispatch({type: '++'})
store.dispatch({type: '++'})
store.dispatch({type: '++'})
}, 2000)